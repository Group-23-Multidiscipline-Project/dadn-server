import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChainState } from './device-state.schema';

export type EventLogDocument = EventLog & Document;

@Schema({
  collection: 'event_logs',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class EventLog {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ type: Number, min: 0, max: 100 })
  humidity?: number;

  @Prop({ type: Number, min: 0 })
  light?: number;

  @Prop({
    type: String,
    enum: Object.values(ChainState),
    required: true,
    index: true,
  })
  state: ChainState;

  @Prop({ required: true })
  action: string;

  @Prop({ type: Date, required: true, default: () => new Date(), index: true })
  timestamp: Date;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

export const EventLogSchema = SchemaFactory.createForClass(EventLog);

EventLogSchema.index({ deviceId: 1, timestamp: -1 });
EventLogSchema.index({ state: 1, timestamp: -1 });
