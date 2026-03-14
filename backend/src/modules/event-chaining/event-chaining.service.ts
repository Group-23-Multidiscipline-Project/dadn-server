import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { EventBusService } from '../event-bus/event-bus.service';
import { ChainEventRecord } from '../event-bus/event-bus.types';
import { SystemLogsService } from '../system-logs/system-logs.service';
import {
  ChainState,
  DeviceState,
  DeviceStateDocument,
} from '../../schemas/device-state.schema';
import { EventLog, EventLogDocument } from '../../schemas/event-log.schema';
import { EventChainingGateway } from './event-chaining.gateway';

const MONITOR_HUMIDITY_THRESHOLD = 20;
const MONITOR_LIGHT_THRESHOLD = 500;
const WATERING_DURATION_MS = 300_000;
const RECOVER_DURATION_MS = 120_000;

const CHAIN_EVENT_TYPES = [
  'SENSOR_RECEIVED',
  'SENSOR_STORED',
  'THRESHOLD_RESOLVED',
  'DECISION_COMPUTED',
  'DECISION_LOG_CREATED',
  'SIMULATION_STATE_UPDATED',
  'FRONTEND_DISPLAYED',
  'DECISION_ACKNOWLEDGED',
  'ACTUATOR_COMMAND_ISSUED',
  'ACTUATOR_COMMAND_CONFIRMED',
  'ACTUATOR_COMMAND_FAILED',
  'CHAIN_STATE_CHANGED',
] as const;

interface SensorDataPayload {
  deviceId: string;
  humidity: number;
  light: number;
}

interface ConfirmWateringPayload {
  deviceId: string;
  state?: string;
}

interface ChainDecisionResult {
  state: ChainState;
  action: string;
  durationSeconds: number;
  message: string;
}

@Injectable()
export class EventChainingService implements OnModuleInit, OnModuleDestroy {
  private readonly unregisterHandlers: Array<() => void> = [];

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly systemLogsService: SystemLogsService,
    private readonly eventChainingGateway: EventChainingGateway,

    @InjectModel(DeviceState.name)
    private readonly deviceStateModel: Model<DeviceStateDocument>,

    @InjectModel(EventLog.name)
    private readonly eventLogModel: Model<EventLogDocument>,
  ) {}

  onModuleInit(): void {
    CHAIN_EVENT_TYPES.forEach((eventType) => {
      const unregister = this.eventBusService.on(
        eventType,
        async (record: ChainEventRecord) => {
          await this.systemLogsService.appendEvent(record);
        },
      );
      this.unregisterHandlers.push(unregister);
    });
  }

  onModuleDestroy(): void {
    this.unregisterHandlers.forEach((unregister) => unregister());
    this.unregisterHandlers.length = 0;
  }

  async processSensorData(payload: SensorDataPayload) {
    const traceId = randomUUID();
    const now = new Date();

    this.emitChainEvent('SENSOR_RECEIVED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.processSensorData',
      data: {
        humidity: payload.humidity,
        light: payload.light,
        deviceId: payload.deviceId,
      },
    });

    const currentState = await this.getOrCreateState(payload.deviceId, now);
    const decision = this.decideFromSensor(currentState, payload, now);

    const persistedState = await this.persistState(
      currentState,
      decision.state,
      now,
    );

    const log = await this.eventLogModel.create({
      deviceId: payload.deviceId,
      humidity: payload.humidity,
      light: payload.light,
      state: persistedState.state,
      action: decision.action,
      timestamp: now,
      metadata: {
        traceId,
        trigger: 'sensor-data',
        durationSeconds: decision.durationSeconds,
      },
    });

    this.emitChainEvent('SENSOR_STORED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.processSensorData',
      data: { eventLogId: log._id.toString() },
    });

    const response = {
      deviceId: payload.deviceId,
      state: persistedState.state,
      action: decision.action,
      duration: decision.durationSeconds,
      timestamp: now.toISOString(),
      message: decision.message,
    };

    this.emitChainEvent('DECISION_COMPUTED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.processSensorData',
      data: response,
    });

    this.emitChainEvent('SIMULATION_STATE_UPDATED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.processSensorData',
      data: { state: persistedState.state, action: decision.action },
    });

    this.emitActuatorAndRealtimeEvents({
      traceId,
      deviceId: payload.deviceId,
      state: persistedState.state,
      action: decision.action,
      durationSeconds: decision.durationSeconds,
      now,
    });

    return response;
  }

  async confirmWatering(payload: ConfirmWateringPayload) {
    const traceId = randomUUID();
    const now = new Date();

    this.emitChainEvent('SENSOR_RECEIVED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.confirmWatering',
      data: { confirmation: payload.state ?? 'WATERING done' },
    });

    const currentState = await this.getOrCreateState(payload.deviceId, now);
    const decision = this.decideFromConfirm(currentState, now);

    const persistedState = await this.persistState(
      currentState,
      decision.state,
      now,
    );

    const log = await this.eventLogModel.create({
      deviceId: payload.deviceId,
      state: persistedState.state,
      action: decision.action,
      timestamp: now,
      metadata: {
        traceId,
        trigger: 'sensor-data/confirm',
        confirmation: payload.state,
        durationSeconds: decision.durationSeconds,
      },
    });

    this.emitChainEvent('SENSOR_STORED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.confirmWatering',
      data: { eventLogId: log._id.toString() },
    });

    const response = {
      deviceId: payload.deviceId,
      state: persistedState.state,
      action: decision.action,
      duration: decision.durationSeconds,
      timestamp: now.toISOString(),
      message: decision.message,
    };

    this.emitChainEvent('CHAIN_STATE_CHANGED', {
      traceId,
      deviceId: payload.deviceId,
      source: 'EventChainingService.confirmWatering',
      data: response,
    });

    this.emitActuatorAndRealtimeEvents({
      traceId,
      deviceId: payload.deviceId,
      state: persistedState.state,
      action: decision.action,
      durationSeconds: decision.durationSeconds,
      now,
    });

    return response;
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
      payload.humidity < MONITOR_HUMIDITY_THRESHOLD &&
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
    now: Date,
  ): ChainDecisionResult {
    if (currentState.state !== ChainState.WATERING) {
      return {
        state: currentState.state,
        action: 'none',
        durationSeconds: 0,
        message: 'Thiết bị không ở trạng thái WATERING để xác nhận.',
      };
    }

    const wateringEndsAt =
      currentState.wateringEndsAt ??
      new Date(currentState.stateStartedAt.getTime() + WATERING_DURATION_MS);
    const remainingMs = wateringEndsAt.getTime() - now.getTime();

    if (remainingMs > 0) {
      return {
        state: ChainState.WATERING,
        action: 'none',
        durationSeconds: Math.ceil(remainingMs / 1000),
        message: 'WATERING chưa đủ 5 phút, tiếp tục chờ.',
      };
    }

    return {
      state: ChainState.RECOVER,
      action: 'stop_pump',
      durationSeconds: RECOVER_DURATION_MS / 1000,
      message: 'Xác nhận WATERING hoàn tất, chuyển sang RECOVER.',
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
    if (input.action === 'start_pump') {
      this.emitChainEvent('ACTUATOR_COMMAND_ISSUED', {
        traceId: input.traceId,
        deviceId: input.deviceId,
        source: 'EventChainingService.emitActuatorAndRealtimeEvents',
        data: {
          command: 'start_pump',
          state: input.state,
          durationSeconds: input.durationSeconds,
        },
      });
    }

    if (input.action === 'stop_pump') {
      this.emitChainEvent('ACTUATOR_COMMAND_CONFIRMED', {
        traceId: input.traceId,
        deviceId: input.deviceId,
        source: 'EventChainingService.emitActuatorAndRealtimeEvents',
        data: {
          command: 'stop_pump',
          state: input.state,
          durationSeconds: input.durationSeconds,
        },
      });
    }

    this.eventChainingGateway.publishState({
      deviceId: input.deviceId,
      state: input.state,
      action: input.action,
      durationSeconds: input.durationSeconds,
      timestamp: input.now.toISOString(),
    });

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

  private emitChainEvent(
    eventType: string,
    payload: {
      traceId: string;
      deviceId?: string;
      decisionLogId?: string;
      source: string;
      data?: Record<string, unknown>;
    },
  ) {
    this.eventBusService.emit(eventType, payload);
  }
}
