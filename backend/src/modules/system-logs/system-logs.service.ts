import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { ChainEventRecord } from '../event-bus/event-bus.types';
import { SystemLog, SystemLogDocument } from '../../schemas/system-log.schema';

@Injectable()
export class SystemLogsService {
  constructor(
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLogDocument>,
  ) {}

  async appendEvent(record: ChainEventRecord) {
    const { payload } = record;

    return this.systemLogModel.create({
      eventId: randomUUID(),
      traceId: payload.traceId,
      eventType: record.eventType,
      deviceId: payload.deviceId,
      source: payload.source,
      occurredAt: record.occurredAt,
      data: payload.data,
    });
  }
}
