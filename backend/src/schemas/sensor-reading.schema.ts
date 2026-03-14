import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SensorReadingDocument = SensorReading & Document;

class Readings {
  @Prop({ type: Number, required: true })
  soilMoisture: number;

  @Prop({ type: Number, required: true })
  light: number;
}

@Schema({ timestamps: { createdAt: 'timestamp', updatedAt: false } })
export class SensorReading {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ type: Readings, required: true, _id: false })
  readings: Readings;

  timestamp: Date;
}

export const SensorReadingSchema = SchemaFactory.createForClass(SensorReading);

SensorReadingSchema.index({ timestamp: -1 });
SensorReadingSchema.index({ deviceId: 1, timestamp: -1 });
