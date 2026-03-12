import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SystemLogDocument = HydratedDocument<SystemLog>;

@Schema({ collection: 'system_logs', versionKey: false })
export class SystemLog {
  @Prop({ required: true })
  level: 'debug' | 'info' | 'warn' | 'error';

  @Prop({ required: true })
  message: string;

  @Prop()
  topic?: string;

  @Prop({ type: Object })
  payload?: Record<string, unknown>;

  @Prop({ required: true, default: () => new Date() })
  timestamp: Date;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);

SystemLogSchema.index({ timestamp: -1 });
SystemLogSchema.index({ level: 1, timestamp: -1 });
