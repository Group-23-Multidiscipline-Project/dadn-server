import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IrrigationEventDocument = HydratedDocument<IrrigationEvent>;

@Schema({ _id: false, versionKey: false })
export class IrrigationMetadata {
  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  direction: string;
}

const IRRIGATION_TIME_SERIES_OPTIONS = {
  timeField: 'timestamp',
  metaField: 'meta',
  granularity: 'seconds' as const,
};

@Schema({
  collection: 'irrigation_events',
  versionKey: false,
  timeseries: IRRIGATION_TIME_SERIES_OPTIONS,
})
export class IrrigationEvent {
  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  direction: string;

  @Prop()
  action?: string;

  @Prop()
  reason?: string;

  @Prop({ default: false })
  shouldIrrigate: boolean;

  @Prop({ default: 0 })
  durationSeconds: number;

  @Prop()
  diseaseRisk?: number;

  @Prop()
  soilMoisture?: number;

  @Prop({ required: true, default: () => new Date() })
  timestamp: Date;

  @Prop({ required: true, type: IrrigationMetadata })
  meta: IrrigationMetadata;

  @Prop({ type: Object })
  raw?: Record<string, unknown>;
}

export const IrrigationEventSchema =
  SchemaFactory.createForClass(IrrigationEvent);

IrrigationEventSchema.index({ nodeId: 1, timestamp: -1 });
IrrigationEventSchema.index({ direction: 1, timestamp: -1 });
