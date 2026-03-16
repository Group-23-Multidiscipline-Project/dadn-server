import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MqttSystemLogDocument = HydratedDocument<MqttSystemLog>;

@Schema({ collection: 'mqtt_system_logs', versionKey: false })
export class MqttSystemLog {
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

export const MqttSystemLogSchema = SchemaFactory.createForClass(MqttSystemLog);

MqttSystemLogSchema.index({ timestamp: -1 });
MqttSystemLogSchema.index({ level: 1, timestamp: -1 });
