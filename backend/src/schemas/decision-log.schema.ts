import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DecisionLogDocument = DecisionLog & Document;

@Schema({ _id: false })
class ChannelDecision {
  @Prop({ required: true })
  allowed: boolean;

  @Prop({ required: true })
  reason: string;

  @Prop({ type: String, enum: ['ON', 'OFF'], required: true })
  simulatedRelay: 'ON' | 'OFF';
}

@Schema({ _id: false })
class InputReadings {
  @Prop({ type: Number, required: true })
  soilMoisture: number;

  @Prop({ type: Number, required: true })
  light: number;
}

@Schema({ _id: false })
class Decisions {
  @Prop({ type: ChannelDecision, required: true })
  irrigation: ChannelDecision;

  @Prop({ type: ChannelDecision, required: true })
  light: ChannelDecision;

  @Prop({ type: ChannelDecision, required: true })
  fertigation: ChannelDecision;
}

@Schema({
  collection: 'decision_logs',
  timestamps: { createdAt: 'timestamp', updatedAt: false },
})
export class DecisionLog {
  @Prop({ required: true, index: true })
  traceId: string;

  @Prop({ type: Types.ObjectId, ref: 'SensorReading', required: true })
  sensorReadingId: Types.ObjectId;

  @Prop({ type: InputReadings, required: true, _id: false })
  inputReadings: InputReadings;

  @Prop({ type: Decisions, required: true, _id: false })
  decisions: Decisions;

  @Prop({
    type: String,
    enum: ['pending', 'displayed', 'acknowledged'],
    default: 'pending',
  })
  displayStatus: 'pending' | 'displayed' | 'acknowledged';

  timestamp: Date;
}

export const DecisionLogSchema = SchemaFactory.createForClass(DecisionLog);

DecisionLogSchema.index({ timestamp: -1 });
DecisionLogSchema.index({ displayStatus: 1 });
DecisionLogSchema.index({ traceId: 1, timestamp: 1 });
