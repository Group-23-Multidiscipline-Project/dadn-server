import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  ChainEventListener,
  ChainEventPayload,
  ChainEventRecord,
} from './event-bus.types';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit(eventType: string, payload: ChainEventPayload): void {
    const record: ChainEventRecord = {
      eventType,
      occurredAt: new Date(),
      payload,
    };
    this.emitter.emit(eventType, record);
  }

  on(eventType: string, listener: ChainEventListener): () => void {
    const wrappedListener = (record: ChainEventRecord) => {
      Promise.resolve(listener(record)).catch((error: unknown) => {
        this.logger.error(`Failed handling event: ${eventType}`, error);
      });
    };

    this.emitter.on(eventType, wrappedListener);

    return () => {
      this.emitter.off(eventType, wrappedListener);
    };
  }
}
