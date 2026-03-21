import { ChainState } from 'src/schemas/device-state.schema';

export interface SensorDataPayload {
  deviceId: string;
  topic?: string;
  moisture: number;
  light: number;
}

export interface ConfirmWateringPayload {
  deviceId: string;
  state?: string;
}

export interface ChainDecisionResult {
  state: ChainState;
  action: string;
  durationSeconds: number;
  message: string;
}
