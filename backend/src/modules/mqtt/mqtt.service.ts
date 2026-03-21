import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { MqttContext } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IrrigationStatusQueryDto } from './dto/irrigation-status-query.dto';
import { SensorHistoryQueryDto } from './dto/sensor-history-query.dto';
import { SystemLogQueryDto } from './dto/system-log-query.dto';
import { EventChainingService } from '../event-chaining/event-chaining.service';
import {
  IrrigationEvent,
  IrrigationEventDocument,
} from './schemas/irrigation-event.schema';
import {
  SensorReading,
  SensorReadingDocument,
} from './schemas/sensor-reading.schema';
import { MqttSystemLogDocument } from './schemas/system-log.schema';
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  normalizePayload,
  resolveTimestamp,
} from 'src/shared/utils/helpers';
import { MqttSensorPayloadAdapterService } from './mqtt-sensor-payload-adapter.service';
import { IrrigationPayloadDto } from './dto/irrigation.dto';
import { ConfirmPayloadDto } from './dto/confirm-watered.dto';

@Injectable()
export class MqttService {
  private readonly logger = new Logger(MqttService.name);

  private readonly sensorTopicRegex = /^yolofarm\/([^/]+)\/sensors\/([^/]+)$/;
  private readonly confirmTopicRegex = /^yolofarm\/([^/]+)\/sensors\/confirm$/;
  private readonly irrigationTopicRegex =
    /^yolofarm\/([^/]+)\/(control|status)\/irrigation$/;

  private readonly mqttDebug = (process.env.MQTT_DEBUG ?? 'true') === 'true';
  private readonly latestSensorByNode = new Map<
    string,
    { moisture?: number; light?: number }
  >();

  constructor(
    @InjectModel(SensorReading.name)
    private readonly sensorReadingModel: Model<SensorReadingDocument>,
    @InjectModel(IrrigationEvent.name)
    private readonly irrigationEventModel: Model<IrrigationEventDocument>,
    @InjectModel('MqttSystemLog')
    private readonly systemLogModel: Model<MqttSystemLogDocument>,
    private readonly eventChainingService: EventChainingService,
    private readonly mqttSensorPayloadAdapterService: MqttSensorPayloadAdapterService,
  ) {}

  async handleIncomingMessage(
    payload: unknown,
    context: MqttContext,
  ): Promise<void> {
    const topic = context.getTopic();
    if (!topic) {
      this.debugLog('[MQTT] Received message without topic', { payload });
      return;
    }

    this.debugLog('[MQTT] Incoming message', {
      topic,
      payload,
    });

    await this.routeIncomingTopic(topic, payload);
  }

  async getSensorHistory(query: SensorHistoryQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.nodeId) {
      filter['meta.nodeId'] = query.nodeId;
    }

    if (query.sensor) {
      const normalizedSensor =
        this.mqttSensorPayloadAdapterService.normalizeSensorKey(query.sensor);
      filter['meta.sensor'] =
        normalizedSensor === query.sensor
          ? normalizedSensor
          : { $in: [query.sensor, normalizedSensor] };
    }

    const readings = (await this.sensorReadingModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(query.limit)
      .lean()
      .exec()) as unknown as Record<string, unknown>[];

    return readings.map((reading) =>
      this.attachCompatibilitySensorValue(reading),
    );
  }

  async getIrrigationStatus(query: IrrigationStatusQueryDto) {
    if (query.nodeId) {
      return this.irrigationEventModel
        .findOne({ nodeId: query.nodeId })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
    }

    return this.irrigationEventModel
      .aggregate([
        { $sort: { timestamp: -1 } },
        { $group: { _id: '$nodeId', latest: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latest' } },
        { $sort: { timestamp: -1 } },
        { $limit: query.limit },
      ])
      .exec();
  }

  async getSystemLogs(query: SystemLogQueryDto) {
    const filter = {};

    if (query.level) {
      filter['level'] = query.level;
    }

    return this.systemLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(query.limit)
      .lean()
      .exec();
  }

  private async routeIncomingTopic(
    topic: string,
    payload: unknown,
  ): Promise<void> {
    if (this.confirmTopicRegex.test(topic)) {
      this.debugLog('[MQTT] Routed to confirmation handler', { topic });
      await this.handleConfirmTopic(topic, payload as ConfirmPayloadDto);
      return;
    }

    if (this.irrigationTopicRegex.test(topic)) {
      this.debugLog('[MQTT] Routed to irrigation handler', { topic });
      await this.handleIrrigationTopic(topic, payload as IrrigationPayloadDto);
      return;
    }

    if (this.sensorTopicRegex.test(topic)) {
      this.debugLog('[MQTT] Routed to sensor handler', { topic });
      await this.handleSensorTopic(topic, payload);
      return;
    }

    this.debugLog('[MQTT] Topic ignored (regex not matched)', { topic });
    this.logger.debug(`Ignored topic: ${topic}`);
  }

  private async handleSensorTopic(
    topic: string,
    payload: unknown,
  ): Promise<void> {
    const match = this.sensorTopicRegex.exec(topic);
    if (!match) {
      return;
    }

    const [, nodeId, sensor] = match;
    const normalizedSensor =
      this.mqttSensorPayloadAdapterService.normalizeSensorKey(sensor);
    const normalizedPayload = normalizePayload(payload);

    this.debugLog('[MQTT] Sensor topic parsed', {
      topic,
      nodeId,
      sensor,
      normalizedSensor,
      normalizedPayload,
    });

    if (!normalizedPayload) {
      this.debugLog('[MQTT] Invalid payload: not a JSON object', {
        topic,
        payload,
      });
      await this.writeSystemLog(
        'warn',
        'Invalid sensor payload format: expected JSON object',
        topic,
      );
      return;
    }

    const value = coerceNumber(normalizedPayload.value);
    if (value === null) {
      this.debugLog('[MQTT] Invalid payload: value is missing/not numeric', {
        topic,
        normalizedPayload,
      });
      await this.writeSystemLog(
        'warn',
        'Sensor payload missing numeric "value" field',
        topic,
        normalizedPayload,
      );
      return;
    }

    const timestamp = resolveTimestamp(normalizedPayload.timestamp);
    if (!timestamp) {
      this.debugLog('[MQTT] Invalid payload: timestamp invalid', {
        topic,
        normalizedPayload,
      });
      await this.writeSystemLog(
        'warn',
        'Sensor payload has invalid timestamp',
        topic,
        normalizedPayload,
      );
      return;
    }

    await this.saveSensorReading(
      topic,
      nodeId,
      sensor,
      normalizedSensor,
      value,
      timestamp,
      normalizedPayload,
    );
    await this.bridgeSensorToEventChaining(
      nodeId,
      normalizedSensor,
      value,
      topic,
    );
  }

  private async saveSensorReading(
    topic: string,
    nodeId: string,
    sensor: string,
    normalizedSensor: string,
    value: number,
    timestamp: Date,
    normalizedPayload: Record<string, unknown>,
  ): Promise<void> {
    this.debugLog('[MQTT] Saving sensor reading to MongoDB', {
      topic,
      nodeId,
      sensor,
      normalizedSensor,
      value,
      timestamp,
    });

    try {
      const createdReading = await this.sensorReadingModel.create({
        topic,
        value,
        ...this.mqttSensorPayloadAdapterService.mapValueToReading(
          sensor,
          value,
        ),
        timestamp,
        meta: {
          farmId: 'yolofarm',
          nodeId,
          sourceType: 'sensor',
          sensor: normalizedSensor,
        },
        raw: {
          ...normalizedPayload,
          sensor,
        },
      });

      this.debugLog('[MQTT] Saved sensor reading', {
        id: createdReading?._id?.toString(),
        topic,
        value,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown MongoDB error';
      this.debugLog('[MQTT] Failed to save sensor reading', {
        topic,
        nodeId,
        sensor,
        value,
        reason,
      });
      throw error;
    }
  }

  private async handleIrrigationTopic(
    topic: string,
    payload: IrrigationPayloadDto,
  ): Promise<void> {
    const match = this.irrigationTopicRegex.exec(topic);
    if (!match) {
      return;
    }

    const [, nodeId, direction] = match;
    const normalizedPayload =
      (normalizePayload(payload) as IrrigationPayloadDto) ?? {};

    await this.saveIrrigationEvent(topic, nodeId, direction, normalizedPayload);
  }

  private async handleConfirmTopic(
    topic: string,
    payload: ConfirmPayloadDto,
  ): Promise<void> {
    const match = this.confirmTopicRegex.exec(topic);
    if (!match) {
      return;
    }

    const [, nodeId] = match;
    const normalizedPayload =
      (normalizePayload(payload) as Record<string, unknown>) ?? {};

    await this.eventChainingService.confirmWatering({
      deviceId: nodeId,
      state: String(normalizedPayload.state),
    });
  }

  private async saveIrrigationEvent(
    topic: string,
    nodeId: string,
    direction: string,
    normalizedPayload: IrrigationPayloadDto,
  ): Promise<void> {
    const durationSeconds =
      coerceNumber(normalizedPayload.durationSeconds) ?? 0;
    const soilMoisture = coerceNumber(normalizedPayload.soilMoisture);
    const shouldIrrigate =
      coerceBoolean(normalizedPayload.shouldIrrigate) ?? false;

    const timestamp =
      resolveTimestamp(normalizedPayload.timestamp) ?? new Date();

    await this.irrigationEventModel.create({
      topic,
      nodeId,
      direction,
      action: coerceString(normalizedPayload.action),
      status: coerceString(normalizedPayload.status),
      reason: coerceString(normalizedPayload.reason),
      shouldIrrigate,
      durationSeconds: Math.max(0, durationSeconds),
      soilMoisture: soilMoisture ?? undefined,
      timestamp,
      meta: {
        nodeId,
        direction,
      },
      raw: normalizedPayload,
    });
  }

  private async writeSystemLog(
    level: LogLevel,
    message: string,
    topic?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.systemLogModel.create({
      level,
      message,
      topic,
      payload,
      timestamp: new Date(),
    });

    if (level === 'error') {
      this.logger.error(message);
      return;
    }

    if (level === 'warn') {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  private attachCompatibilitySensorValue(
    reading: Record<string, unknown>,
  ): Record<string, unknown> {
    const meta = reading.meta;
    if (!meta || typeof meta !== 'object') {
      return reading;
    }
    const sensor = (meta as Record<string, unknown>).sensor;
    if (typeof sensor !== 'string') {
      return reading;
    }

    const normalizedSensor =
      this.mqttSensorPayloadAdapterService.normalizeSensorKey(sensor);

    if (reading[normalizedSensor] !== undefined) {
      return reading;
    }

    const value = coerceNumber(reading.value);
    if (value === null) {
      return reading;
    }

    return {
      ...reading,
      [normalizedSensor]: value,
    };
  }

  private async bridgeSensorToEventChaining(
    nodeId: string,
    sensor: string,
    value: number,
    topic: string,
  ): Promise<void> {
    const eventChainingSensor =
      this.mqttSensorPayloadAdapterService.getEventChainingSensorKey(sensor);

    if (!eventChainingSensor) {
      return;
    }

    const latestValues = this.latestSensorByNode.get(nodeId) ?? {};
    latestValues[eventChainingSensor] = value;
    this.latestSensorByNode.set(nodeId, latestValues);

    this.debugLog('[MQTT] Bridge cache updated', {
      nodeId,
      sensor,
      eventChainingSensor,
      latestValues,
    });

    if (
      latestValues.moisture === undefined ||
      latestValues.light === undefined
    ) {
      this.debugLog('[MQTT] Waiting for both moisture and light', {
        nodeId,
        latestValues,
      });
      return;
    }

    const { moisture, light } = latestValues;
    this.latestSensorByNode.delete(nodeId);

    try {
      this.debugLog('[MQTT] Bridging to event-chaining', {
        nodeId,
        moisture,
        light,
      });
      await this.eventChainingService.processSensorData({
        deviceId: nodeId,
        topic,
        moisture,
        light,
      });
      this.debugLog('[MQTT] Event-chaining processed successfully', {
        nodeId,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown error while bridging';
      this.debugLog('[MQTT] Event-chaining bridge failed', {
        nodeId,
        reason,
      });
      await this.writeSystemLog(
        'error',
        `Failed to bridge MQTT sensor payload to event chaining: ${reason}`,
        topic,
        {
          nodeId,
          moisture,
          light,
        },
      );
    }
  }

  private debugLog(message: string, payload?: unknown): void {
    if (!this.mqttDebug) {
      return;
    }

    if (payload === undefined) {
      this.logger.debug(message);
      return;
    }

    this.logger.debug(`${message} ${JSON.stringify(payload)}`);
  }
}
