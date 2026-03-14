import { Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

import {
  SensorReading,
  SensorReadingDocument,
} from '../../schemas/sensor-reading.schema';
import {
  DecisionLog,
  DecisionLogDocument,
} from '../../schemas/decision-log.schema';
import {
  SpeciesThreshold,
  SpeciesThresholdDocument,
} from '../../schemas/species-threshold.schema';
import {
  SimulationState,
  SimulationStateDocument,
} from '../../schemas/simulation-state.schema';
import { InjectModel } from '@nestjs/mongoose';

interface SensorPushPayload {
  deviceId: string;
  soilMoisture: number;
  light: number;
  speciesName?: string;
}

@Injectable()
export class DecisionService {
  constructor(
    @InjectModel(SensorReading.name)
    private readonly sensorReadingModel: Model<SensorReadingDocument>,

    @InjectModel(DecisionLog.name)
    private readonly decisionLogModel: Model<DecisionLogDocument>,

    @InjectModel(SpeciesThreshold.name)
    private readonly speciesThresholdModel: Model<SpeciesThresholdDocument>,

    @InjectModel(SimulationState.name)
    private readonly simulationStateModel: Model<SimulationStateDocument>,
  ) {}

  async processSensorPush(payload: SensorPushPayload) {
    const { deviceId, soilMoisture, light, speciesName = 'Tomato' } = payload;

    // Step 1: Save sensor reading
    const reading = await this.sensorReadingModel.create({
      deviceId,
      readings: { soilMoisture, light },
    });

    // Step 2: Fetch species thresholds
    const threshold = await this.speciesThresholdModel.findOne({ speciesName });
    if (!threshold) {
      throw new NotFoundException(
        `Không tìm thấy ngưỡng cho loài cây: ${speciesName}`,
      );
    }

    // Step 3: Make decisions
    const decisions = this.makeDecision(
      { soilMoisture, light },
      threshold.thresholds,
    );

    // Step 4: Save decision log
    const log = await this.decisionLogModel.create({
      sensorReadingId: reading._id,
      inputReadings: { soilMoisture, light },
      decisions,
      displayStatus: 'pending',
    });

    // Step 5: Upsert simulation state (for web polling)
    await this.simulationStateModel.findByIdAndUpdate(
      'current',
      {
        $set: {
          deviceId,
          latestReadings: { soilMoisture, light },
          relaySimulation: this.buildRelayDisplay(decisions),
          decisionLogId: log._id,
        },
      },
      { upsert: true, new: true },
    );

    return { reading, log, decisions };
  }

  private makeDecision(
    readings: { soilMoisture: number; light: number },
    thresholds: {
      soilMoisture: { lb: number; ub: number };
      light: { lb: number; ub: number };
    },
  ) {
    // Soil moisture ADC is INVERTED: high ADC = dry, low ADC = wet
    // Irrigate when ADC > ub (too dry)
    const moistureDry = readings.soilMoisture > thresholds.soilMoisture.ub;
    const moistureInRange =
      readings.soilMoisture >= thresholds.soilMoisture.lb &&
      readings.soilMoisture <= thresholds.soilMoisture.ub;

    // Light ADC is DIRECT: low ADC = dark → turn on grow light
    const lightDim = readings.light < thresholds.light.lb;

    return {
      irrigation: {
        allowed: moistureDry,
        reason: moistureDry
          ? `Đất quá khô (ADC ${readings.soilMoisture} > ngưỡng ${thresholds.soilMoisture.ub})`
          : `Độ ẩm đất ổn định (ADC ${readings.soilMoisture})`,
        simulatedRelay: moistureDry ? 'ON' : 'OFF',
      },
      light: {
        allowed: lightDim,
        reason: lightDim
          ? `Ánh sáng yếu (ADC ${readings.light} < ngưỡng ${thresholds.light.lb})`
          : `Ánh sáng đủ (ADC ${readings.light})`,
        simulatedRelay: lightDim ? 'ON' : 'OFF',
      },
      fertigation: {
        allowed: moistureInRange,
        reason: moistureInRange
          ? `Độ ẩm trong vùng tối ưu (ADC ${readings.soilMoisture})`
          : 'Chưa đủ điều kiện bón phân',
        simulatedRelay: 'OFF' as const,
      },
    };
  }

  private buildRelayDisplay(
    decisions: ReturnType<DecisionService['makeDecision']>,
  ) {
    return {
      irrigation: {
        state: decisions.irrigation.simulatedRelay,
        ledColor: decisions.irrigation.allowed ? 'blue' : 'gray',
        label: decisions.irrigation.allowed ? 'Đang tưới' : 'Không tưới',
      },
      light: {
        state: decisions.light.simulatedRelay,
        ledColor: decisions.light.allowed ? 'yellow' : 'gray',
        label: decisions.light.allowed ? 'Đèn bật' : 'Đèn tắt',
      },
      fertigation: {
        state: decisions.fertigation.simulatedRelay,
        ledColor: decisions.fertigation.allowed ? 'green' : 'gray',
        label: decisions.fertigation.allowed
          ? 'Đang bón phân'
          : 'Không bón phân',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Query methods for REST API
  // -------------------------------------------------------------------------

  async getSimulationState() {
    const state = await this.simulationStateModel
      .findById('current')
      .populate('decisionLogId')
      .lean();
    return state ?? null;
  }

  async getDecisionLogs(opts: {
    page: number;
    limit: number;
    status?: 'pending' | 'displayed' | 'acknowledged';
  }) {
    const { page, limit, status } = opts;
    const filter = status ? { displayStatus: status } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.decisionLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.decisionLogModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async acknowledgeDecisionLog(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Decision log không hợp lệ: ${id}`);
    }

    const log = await this.decisionLogModel.findByIdAndUpdate(
      id,
      { $set: { displayStatus: 'acknowledged' } },
      { new: true },
    );

    if (!log) {
      throw new NotFoundException(`Không tìm thấy decision log: ${id}`);
    }

    return log;
  }
}
