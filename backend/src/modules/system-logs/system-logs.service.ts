import { Injectable, Logger } from '@nestjs/common';
import { ChainEventRecord } from '../event-bus/event-bus.types';

@Injectable()
export class SystemLogsService {
  private readonly logger = new Logger(SystemLogsService.name);

  appendEvent(record: ChainEventRecord) {
    const { payload, eventType } = record;

    this.logger.log(
      `[${eventType}] Trace: ${payload.traceId} | Device: ${payload.deviceId} | Source: ${payload.source} | Data: ${JSON.stringify(payload.data)}`,
    );
  }
}
