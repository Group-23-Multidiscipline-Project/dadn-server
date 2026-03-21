import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { connect, IClientOptions, MqttClient } from 'mqtt';
import { EventBusService } from '../event-bus/event-bus.service';
import { ChainEventRecord } from '../event-bus/event-bus.types';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { EventLogQueryDto } from './dto/event-log-query.dto';
import {
  ChainState,
  DeviceState,
  DeviceStateDocument,
} from '../../schemas/device-state.schema';
import { EventLog, EventLogDocument } from '../../schemas/event-log.schema';
import { EventChainingGateway } from './event-chaining.gateway';
import { ConfigService } from '../config/config.service';
import {
  CHAIN_EVENT_TYPES,
  MONITOR_LIGHT_THRESHOLD,
  MONITOR_MOISTURE_THRESHOLD,
  RECOVER_DURATION_MS,
  WATERING_DURATION_MS,
} from './constants/event-chaining.constant';
import {
  ChainDecisionResult,
  ConfirmWateringPayload,
  SensorDataPayload,
} from './interfaces/event-chaining.interface';

@Injectable()
export class EventChainingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventChainingService.name);
  private readonly mqttTopicBase = process.env.MQTT_TOPIC_BASE ?? 'yolofarm';
  private readonly mqttCommandQos = this.resolveMqttQos(
    process.env.MQTT_COMMAND_QOS,
  );
  private readonly unregisterHandlers: Array<() => void> = [];
  private mqttCommandClient: MqttClient | null = null;

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly systemLogsService: SystemLogsService,
    private readonly eventChainingGateway: EventChainingGateway,
    private readonly configService: ConfigService,

    @InjectModel(DeviceState.name)
    private readonly deviceStateModel: Model<DeviceStateDocument>,

    @InjectModel(EventLog.name)
    private readonly eventLogModel: Model<EventLogDocument>,
  ) {}

  onModuleInit(): void {
    this.initMqttCommandPublisher();

    CHAIN_EVENT_TYPES.forEach((eventType) => {
      const unregister = this.eventBusService.on(
        eventType,
        (record: ChainEventRecord) => {
          this.systemLogsService.appendEvent(record);
        },
      );
      this.unregisterHandlers.push(unregister);
    });
  }

  onModuleDestroy(): void {
    this.unregisterHandlers.forEach((unregister) => unregister());
    this.unregisterHandlers.length = 0;

    if (this.mqttCommandClient) {
      this.mqttCommandClient.end(true);
      this.mqttCommandClient = null;
    }
  }

  async processSensorData(payload: SensorDataPayload) {
    return this.runChainingPipeline(
      payload.deviceId,
      'EventChainingService.processSensorData',
      {
        moisture: payload.moisture,
        light: payload.light,
        deviceId: payload.deviceId,
        topic: payload.topic,
      },
      (state, now) => this.decideFromSensor(state, payload, now),
      (_, decision, traceId) => ({
        topic: payload.topic,
        moisture: payload.moisture,
        light: payload.light,
        metadata: {
          traceId,
          trigger: 'sensor-data',
          topic: payload.topic,
          durationSeconds: decision.durationSeconds,
        },
      }),
    );
  }

  async confirmWatering(payload: ConfirmWateringPayload) {
    return this.runChainingPipeline(
      payload.deviceId,
      'EventChainingService.confirmWatering',
      { confirmation: payload.state ?? 'WATERING done' },
      (state) => this.decideFromConfirm(state),
      (_, decision, traceId) => ({
        metadata: {
          traceId,
          trigger: 'device/confirm',
          confirmation: payload.state,
          durationSeconds: decision.durationSeconds,
        },
      }),
    );
  }

  private async runChainingPipeline(
    deviceId: string,
    source: string,
    triggerData: Record<string, unknown>,
    decideFn: (state: DeviceStateDocument, now: Date) => ChainDecisionResult,
    buildLogPayload: (
      state: ChainState,
      decision: ChainDecisionResult,
      traceId: string,
      now: Date,
    ) => Partial<EventLog>,
  ) {
    const traceId = randomUUID();
    const now = new Date();

    this.emitChainEvent('SENSOR_RECEIVED', {
      traceId,
      deviceId,
      source,
      data: triggerData,
    });

    const currentState = await this.getOrCreateState(deviceId, now);
    const decision = decideFn(currentState, now);
    const persistedState = await this.persistState(
      currentState,
      decision.state,
      now,
    );

    const log = await this.eventLogModel.create({
      deviceId,
      state: persistedState.state,
      action: decision.action,
      timestamp: now,
      ...buildLogPayload(persistedState.state, decision, traceId, now),
    });

    this.emitChainEvent('SENSOR_STORED', {
      traceId,
      deviceId,
      source,
      data: { eventLogId: log._id.toString() },
    });

    const response = {
      deviceId,
      state: persistedState.state,
      action: decision.action,
      duration: decision.durationSeconds,
      timestamp: now.toISOString(),
      message: decision.message,
    };

    this.emitChainEvent('CHAIN_STATE_CHANGED', {
      traceId,
      deviceId,
      source,
      data: response,
    });

    this.emitActuatorAndRealtimeEvents({
      traceId,
      deviceId,
      state: persistedState.state,
      action: decision.action,
      durationSeconds: decision.durationSeconds,
      now,
    });

    return response;
  }

  async getDeviceState(deviceId: string) {
    const [stateDoc, latestLog] = await Promise.all([
      this.deviceStateModel.findOne({ deviceId }),
      this.eventLogModel.findOne({ deviceId }).sort({ timestamp: -1 }),
    ]);

    if (!stateDoc) {
      return {
        deviceId,
        exists: false,
        state: ChainState.MONITOR,
        action: 'none',
        remainingSeconds: 0,
        stateStartedAt: null,
        wateringEndsAt: null,
        recoverEndsAt: null,
        latestEvent: latestLog
          ? {
              state: latestLog.state,
              action: latestLog.action,
              timestamp: latestLog.timestamp.toISOString(),
            }
          : null,
      };
    }

    const remainingSeconds = this.calculateRemainingSeconds(
      stateDoc,
      new Date(),
    );

    return {
      deviceId: stateDoc.deviceId,
      exists: true,
      state: stateDoc.state,
      action: latestLog?.action ?? 'none',
      remainingSeconds,
      stateStartedAt: stateDoc.stateStartedAt.toISOString(),
      wateringEndsAt: stateDoc.wateringEndsAt?.toISOString() ?? null,
      recoverEndsAt: stateDoc.recoverEndsAt?.toISOString() ?? null,
      latestEvent: latestLog
        ? {
            state: latestLog.state,
            action: latestLog.action,
            timestamp: latestLog.timestamp.toISOString(),
          }
        : null,
    };
  }

  async getEventLogs(query: EventLogQueryDto): Promise<unknown[]> {
    const filter: Record<string, unknown> = {};

    if (query.deviceId) {
      filter['deviceId'] = query.deviceId;
    }

    if (query.topic) {
      filter['topic'] = query.topic;
    }

    if (query.state) {
      filter['state'] = query.state;
    }

    if (query.action) {
      filter['action'] = query.action;
    }

    return this.eventLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(query.limit)
      .lean()
      .exec();
  }
  private decideFromSensor(
    currentState: DeviceStateDocument,
    payload: SensorDataPayload,
    now: Date,
  ): ChainDecisionResult {
    if (currentState.state === ChainState.WATERING) {
      const wateringEndsAt =
        currentState.wateringEndsAt ??
        new Date(currentState.stateStartedAt.getTime() + WATERING_DURATION_MS);
      const remainingMs = wateringEndsAt.getTime() - now.getTime();

      if (remainingMs > 0) {
        return {
          state: ChainState.WATERING,
          action: 'none',
          durationSeconds: Math.ceil(remainingMs / 1000),
          message: 'Đang tưới. Chờ xác nhận kết thúc WATERING.',
        };
      }

      return {
        state: ChainState.RECOVER,
        action: 'stop_pump',
        durationSeconds: RECOVER_DURATION_MS / 1000,
        message: 'Hết thời gian tưới, chuyển sang RECOVER.',
      };
    }

    if (currentState.state === ChainState.RECOVER) {
      const recoverEndsAt =
        currentState.recoverEndsAt ??
        new Date(currentState.stateStartedAt.getTime() + RECOVER_DURATION_MS);
      const remainingMs = recoverEndsAt.getTime() - now.getTime();

      if (remainingMs > 0) {
        return {
          state: ChainState.RECOVER,
          action: 'none',
          durationSeconds: Math.ceil(remainingMs / 1000),
          message: 'RECOVER đang chạy để sensor ổn định.',
        };
      }

      return {
        state: ChainState.MONITOR,
        action: 'none',
        durationSeconds: 0,
        message: 'Hoàn tất RECOVER, quay lại MONITOR.',
      };
    }

    if (
      payload.moisture < MONITOR_MOISTURE_THRESHOLD &&
      payload.light > MONITOR_LIGHT_THRESHOLD
    ) {
      return {
        state: ChainState.WATERING,
        action: 'start_pump',
        durationSeconds: WATERING_DURATION_MS / 1000,
        message: 'Điều kiện đạt ngưỡng, bắt đầu WATERING.',
      };
    }

    return {
      state: ChainState.MONITOR,
      action: 'none',
      durationSeconds: 0,
      message: 'Điều kiện chưa đạt, tiếp tục MONITOR.',
    };
  }

  private decideFromConfirm(
    currentState: DeviceStateDocument,
  ): ChainDecisionResult {
    if (currentState.state === ChainState.MONITOR) {
      return {
        state: currentState.state,
        action: 'none',
        durationSeconds: 0,
        message: 'Thiết bị không ở trạng thái WATERING/RECOVER để xác nhận.',
      };
    }

    if (currentState.state === ChainState.RECOVER) {
      return {
        state: ChainState.MONITOR,
        action: 'none',
        durationSeconds: 0,
        message: 'Thiết bị xác nhận đã recover xong, chuyển sang MONITOR.',
      };
    }

    return {
      state: ChainState.RECOVER,
      action: 'none',
      durationSeconds: RECOVER_DURATION_MS / 1000,
      message: 'Thiết bị xác nhận đã tưới xong, chuyển sang RECOVER.',
    };
  }

  private async getOrCreateState(deviceId: string, now: Date) {
    const existing = await this.deviceStateModel.findOne({ deviceId });
    if (existing) {
      return existing;
    }

    return this.deviceStateModel.create({
      deviceId,
      state: ChainState.MONITOR,
      stateStartedAt: now,
    });
  }

  private async persistState(
    currentState: DeviceStateDocument,
    nextState: ChainState,
    now: Date,
  ) {
    if (currentState.state === nextState) {
      return currentState;
    }

    currentState.state = nextState;
    currentState.stateStartedAt = now;

    if (nextState === ChainState.WATERING) {
      currentState.wateringEndsAt = new Date(
        now.getTime() + WATERING_DURATION_MS,
      );
      currentState.recoverEndsAt = undefined;
    } else if (nextState === ChainState.RECOVER) {
      currentState.recoverEndsAt = new Date(
        now.getTime() + RECOVER_DURATION_MS,
      );
      currentState.wateringEndsAt = undefined;
    } else {
      currentState.wateringEndsAt = undefined;
      currentState.recoverEndsAt = undefined;
    }

    return currentState.save();
  }

  private emitActuatorAndRealtimeEvents(input: {
    traceId: string;
    deviceId: string;
    state: ChainState;
    action: string;
    durationSeconds: number;
    now: Date;
  }) {
    if (input.action === 'start_pump' || input.action === 'stop_pump') {
      const eventType =
        input.action === 'start_pump'
          ? 'ACTUATOR_COMMAND_ISSUED'
          : 'ACTUATOR_COMMAND_CONFIRMED';

      this.emitChainEvent(eventType, {
        traceId: input.traceId,
        deviceId: input.deviceId,
        source: 'EventChainingService.emitActuatorAndRealtimeEvents',
        data: {
          command: input.action,
          state: input.state,
          durationSeconds: input.durationSeconds,
        },
      });

      this.publishActuatorCommand({
        traceId: input.traceId,
        deviceId: input.deviceId,
        action: input.action,
        durationSeconds: input.durationSeconds,
        now: input.now,
      });
    }

    // Cập nhật trạng thái realtime qua WebSockets cho Frontend
    this.eventChainingGateway.publishState({
      deviceId: input.deviceId,
      state: input.state,
      action: input.action,
      durationSeconds: input.durationSeconds,
      timestamp: input.now.toISOString(),
    });

    // Ghi log xác nhận đã đẩy dữ liệu lên Frontend
    this.emitChainEvent('FRONTEND_DISPLAYED', {
      traceId: input.traceId,
      deviceId: input.deviceId,
      source: 'EventChainingService.emitActuatorAndRealtimeEvents',
      data: {
        state: input.state,
        action: input.action,
        durationSeconds: input.durationSeconds,
      },
    });
  }

  private calculateRemainingSeconds(state: DeviceStateDocument, now: Date) {
    if (state.state === ChainState.WATERING && state.wateringEndsAt) {
      const diff = state.wateringEndsAt.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diff / 1000));
    }

    if (state.state === ChainState.RECOVER && state.recoverEndsAt) {
      const diff = state.recoverEndsAt.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diff / 1000));
    }

    return 0;
  }

  private emitChainEvent(
    eventType: string,
    payload: {
      traceId: string;
      deviceId?: string;
      source: string;
      data?: Record<string, unknown>;
    },
  ) {
    this.eventBusService.emit(eventType, payload);
  }

  private initMqttCommandPublisher() {
    if (this.mqttCommandClient) {
      return;
    }

    const mqttOptions: IClientOptions = {
      host: this.configService.mqtt.mqttHost,
      port: this.configService.mqtt.mqttPort,
      protocol: 'mqtts',
      username: this.configService.mqtt.hivemqUsername,
      password: this.configService.mqtt.hivemqPassword,
    };

    this.mqttCommandClient = connect(mqttOptions);

    this.mqttCommandClient.on('connect', () => {
      this.logger.log(
        `MQTT actuator publisher connected (Host ${this.configService.mqtt.mqttHost}) qos=${this.mqttCommandQos}`,
      );
    });

    this.mqttCommandClient.on('error', (error) => {
      this.logger.error(
        `MQTT actuator publisher error: ${error.message}`,
        error.stack,
      );
    });
  }

  private publishActuatorCommand(input: {
    traceId: string;
    deviceId: string;
    action: 'start_pump' | 'stop_pump';
    durationSeconds: number;
    now: Date;
  }) {
    const topic = `${this.mqttTopicBase}/${input.deviceId}/control/irrigation`;
    const payload = JSON.stringify({
      traceId: input.traceId,
      action: input.action,
      status: input.action === 'start_pump' ? 'pending_on' : 'pending_off',
      shouldIrrigate: input.action === 'start_pump',
      durationSeconds: input.durationSeconds,
      timestamp: input.now.toISOString(),
    });

    if (!this.mqttCommandClient) {
      this.logger.warn(
        `MQTT actuator publisher is not initialized, skip publish topic=${topic}`,
      );
      return;
    }

    this.mqttCommandClient.publish(
      topic,
      payload,
      { qos: this.mqttCommandQos },
      (error?: Error) => {
        if (error) {
          this.logger.error(
            `Failed to publish actuator command topic=${topic}: ${error.message}`,
            error.stack,
          );
          return;
        }

        this.logger.log(`Published actuator command topic=${topic} ${payload}`);
      },
    );
  }

  private resolveMqttQos(rawQos?: string) {
    const parsed = Number(rawQos ?? '1');
    if (parsed === 0 || parsed === 1 || parsed === 2) {
      return parsed;
    }

    return 1;
  }
}
