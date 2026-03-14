import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SimulationStateDocument = SimulationState & Document;

@Schema({ _id: false })
class RelayChannel {
  @Prop({ type: String, enum: ['ON', 'OFF'], required: true })
  state: 'ON' | 'OFF';

  @Prop({ required: true })
  ledColor: string;

  @Prop({ required: true })
  label: string;
}

@Schema({ _id: false })
class LatestReadings {
  @Prop({ type: Number, required: true })
  soilMoisture: number;

  @Prop({ type: Number, required: true })
  light: number;
}

@Schema({ _id: false })
class RelaySimulation {
  @Prop({ type: RelayChannel, required: true })
  irrigation: RelayChannel;

  @Prop({ type: RelayChannel, required: true })
  light: RelayChannel;

  @Prop({ type: RelayChannel, required: true })
  fertigation: RelayChannel;
}

@Schema({
  collection: 'simulation_states',
  timestamps: { createdAt: false, updatedAt: 'updatedAt' },
})
export class SimulationState {
  // Fixed to "current" — always upserted by _id
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ type: LatestReadings, required: true, _id: false })
  latestReadings: LatestReadings;

  @Prop({ type: RelaySimulation, required: true, _id: false })
  relaySimulation: RelaySimulation;

  @Prop({ type: Types.ObjectId, ref: 'DecisionLog' })
  decisionLogId: Types.ObjectId;

  updatedAt: Date;
}

export const SimulationStateSchema =
  SchemaFactory.createForClass(SimulationState);
