export interface ChainEventPayload {
  traceId: string;
  deviceId?: string;
  source?: string;
  data?: Record<string, unknown>;
}

export interface ChainEventRecord {
  eventType: string;
  occurredAt: Date;
  payload: ChainEventPayload;
}

export type ChainEventListener = (
  record: ChainEventRecord,
) => void | Promise<void>;
