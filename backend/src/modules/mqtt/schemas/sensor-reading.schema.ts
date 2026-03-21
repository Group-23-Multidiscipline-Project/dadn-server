import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SensorReadingDocument = HydratedDocument<SensorReading>;

@Schema({ _id: false, versionKey: false })
export class SensorMetadata {
  @Prop({ required: true })
  farmId: string;

  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  sourceType: string;

  @Prop({ required: true })
  sensor: string;
}

const SENSOR_TIME_SERIES_OPTIONS = {
  timeField: 'timestamp',
  metaField: 'meta',
  granularity: 'seconds' as const,
};

@Schema({
  collection: 'sensor_readings',
  versionKey: false,
  timeseries: SENSOR_TIME_SERIES_OPTIONS,
})
export class SensorReading {
  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  value: number;

  @Prop({ type: Number })
  moisture?: number;

  @Prop({ type: Number })
  light?: number;

  @Prop({ required: true, default: () => new Date() })
  timestamp: Date;

  @Prop({ required: true, type: SensorMetadata })
  meta: SensorMetadata;

  @Prop({ type: Object })
  raw?: Record<string, unknown>;
}

export const SensorReadingSchema = SchemaFactory.createForClass(SensorReading);

SensorReadingSchema.index({
  'meta.nodeId': 1,
  'meta.sensor': 1,
  timestamp: -1,
});
SensorReadingSchema.index({ topic: 1, timestamp: -1 });
