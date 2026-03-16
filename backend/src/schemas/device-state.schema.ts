import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ChainState {
  MONITOR = 'MONITOR',
  WATERING = 'WATERING',
  RECOVER = 'RECOVER',
}

export type DeviceStateDocument = DeviceState & Document;

@Schema({
  collection: 'device_states',
  timestamps: { createdAt: false, updatedAt: 'updatedAt' },
})
export class DeviceState {
  @Prop({ required: true, unique: true, index: true })
  deviceId: string;

  @Prop({
    type: String,
    enum: Object.values(ChainState),
    default: ChainState.MONITOR,
    required: true,
  })
  state: ChainState;

  @Prop({ type: Date, required: true })
  stateStartedAt: Date;

  @Prop({ type: Date })
  wateringEndsAt?: Date;

  @Prop({ type: Date })
  recoverEndsAt?: Date;

  updatedAt: Date;
}

export const DeviceStateSchema = SchemaFactory.createForClass(DeviceState);

DeviceStateSchema.index({ state: 1, updatedAt: -1 });
