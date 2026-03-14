import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemLogDocument = SystemLog & Document;

@Schema({
  collection: 'system_logs',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class SystemLog {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ required: true, index: true })
  traceId: string;

  @Prop({ required: true, index: true })
  eventType: string;

  @Prop()
  deviceId?: string;

  @Prop()
  source?: string;

  @Prop({ type: Date, required: true })
  occurredAt: Date;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  createdAt: Date;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);

SystemLogSchema.index({ traceId: 1, occurredAt: 1 });
SystemLogSchema.index({ eventType: 1, occurredAt: -1 });
