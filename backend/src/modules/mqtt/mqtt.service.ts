import { Injectable, Logger } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  MqttContext,
  Payload,
} from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IrrigationStatusQueryDto } from './dto/irrigation-status-query.dto';
import { SensorHistoryQueryDto } from './dto/sensor-history-query.dto';
import { SystemLogQueryDto } from './dto/system-log-query.dto';
import {
  IrrigationEvent,
  IrrigationEventDocument,
} from './schemas/irrigation-event.schema';
import {
  SensorReading,
  SensorReadingDocument,
} from './schemas/sensor-reading.schema';
import { SystemLog, SystemLogDocument } from './schemas/system-log.schema';
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  normalizePayload,
  resolveTimestamp,
} from 'src/shared/utils/helpers';
import { LogLevel } from './types/log-level.type';

@Injectable()
export class MqttService {
  private readonly logger = new Logger(MqttService.name);
  private readonly sensorTopicRegex = /^yolofarm\/([^/]+)\/sensors\/([^/]+)$/;
  private readonly irrigationTopicRegex =
    /^yolofarm\/([^/]+)\/(control|status)\/irrigation$/;

  constructor(
    @InjectModel(SensorReading.name)
    private readonly sensorReadingModel: Model<SensorReadingDocument>,
    @InjectModel(IrrigationEvent.name)
    private readonly irrigationEventModel: Model<IrrigationEventDocument>,
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLogDocument>,
  ) {}

  @MessagePattern('#')
  async handleIncomingMessage(
    @Payload() payload: unknown,
    @Ctx() context: MqttContext,
  ): Promise<void> {
    const topic = context.getTopic();
    if (!topic) {
      return;
    }

    await this.routeIncomingTopic(topic, payload);
  }

  async getSensorHistory(query: SensorHistoryQueryDto): Promise<unknown[]> {
    const filter: Record<string, unknown> = {};

    if (query.nodeId) {
      filter['meta.nodeId'] = query.nodeId;
    }

    if (query.sensor) {
      filter['meta.sensor'] = query.sensor;
    }

    if (query.from || query.to) {
      const timestampFilter: { $gte?: Date; $lte?: Date } = {};

      if (query.from) {
        timestampFilter.$gte = new Date(query.from);
      }

      if (query.to) {
        timestampFilter.$lte = new Date(query.to);
      }

      filter['timestamp'] = timestampFilter;
    }

    return this.sensorReadingModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(query.limit)
      .lean()
      .exec();
  }

  async getIrrigationStatus(query: IrrigationStatusQueryDto): Promise<unknown> {
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

  async getSystemLogs(query: SystemLogQueryDto): Promise<unknown[]> {
    const filter: Record<string, unknown> = {};

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
    if (this.sensorTopicRegex.test(topic)) {
      await this.handleSensorTopic(topic, payload);
      return;
    }

    if (this.irrigationTopicRegex.test(topic)) {
      await this.handleIrrigationTopic(topic, payload);
      return;
    }

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

    const nodeId = match[1];
    const sensor = match[2];
    const normalizedPayload = normalizePayload(payload);

    if (!normalizedPayload) {
      await this.writeSystemLog(
        'warn',
        'Invalid sensor payload format: expected JSON object',
        topic,
      );
      return;
    }

    const value = coerceNumber(normalizedPayload.value);
    if (value === null) {
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
      await this.writeSystemLog(
        'warn',
        'Sensor payload has invalid timestamp',
        topic,
        normalizedPayload,
      );
      return;
    }

    await this.sensorReadingModel.create({
      topic,
      value,
      timestamp,
      meta: {
        farmId: 'yolofarm',
        nodeId,
        sourceType: 'sensor',
        sensor,
      },
      raw: normalizedPayload,
    });
  }

  private async handleIrrigationTopic(
    topic: string,
    payload: unknown,
  ): Promise<void> {
    const match = this.irrigationTopicRegex.exec(topic);
    if (!match) {
      return;
    }

    const nodeId = match[1];
    const direction = match[2];
    const normalizedPayload = normalizePayload(payload) ?? {};

    const durationSecondsRaw =
      normalizedPayload.durationSeconds ?? normalizedPayload.duration_sec;
    const durationSeconds = coerceNumber(durationSecondsRaw) ?? 0;

    const diseaseRiskRaw =
      normalizedPayload.diseaseRisk ?? normalizedPayload.disease_risk;
    const diseaseRisk = coerceNumber(diseaseRiskRaw) ?? undefined;

    const soilMoistureRaw =
      normalizedPayload.soilMoisture ?? normalizedPayload.soil_moisture;
    const soilMoisture = coerceNumber(soilMoistureRaw) ?? undefined;

    const shouldIrrigateRaw =
      normalizedPayload.shouldIrrigate ?? normalizedPayload.should_irrigate;
    const shouldIrrigate = coerceBoolean(shouldIrrigateRaw) ?? false;

    const timestamp = resolveTimestamp(normalizedPayload.timestamp);

    await this.irrigationEventModel.create({
      topic,
      nodeId,
      direction,
      action: coerceString(normalizedPayload.action),
      reason: coerceString(normalizedPayload.reason),
      shouldIrrigate,
      durationSeconds: durationSeconds >= 0 ? durationSeconds : 0,
      diseaseRisk,
      soilMoisture,
      timestamp: timestamp ?? new Date(),
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
}
