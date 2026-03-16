import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SpeciesThresholdDocument = SpeciesThreshold & Document;

@Schema({ _id: false })
class ThresholdRange {
  @Prop({ type: Number, required: true })
  lb: number;

  @Prop({ type: Number, required: true })
  ub: number;
}

@Schema({ _id: false })
class Thresholds {
  @Prop({ type: ThresholdRange, required: true })
  soilMoisture: ThresholdRange;

  @Prop({ type: ThresholdRange, required: true })
  light: ThresholdRange;
}

@Schema({ collection: 'species_thresholds', timestamps: true })
export class SpeciesThreshold {
  @Prop({ required: true, unique: true })
  speciesName: string;

  @Prop({ type: Thresholds, required: true, _id: false })
  thresholds: Thresholds;
}

export const SpeciesThresholdSchema =
  SchemaFactory.createForClass(SpeciesThreshold);
