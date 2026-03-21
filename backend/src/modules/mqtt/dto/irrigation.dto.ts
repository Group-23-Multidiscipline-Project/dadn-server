export type IrrigationPayloadDto = {
  durationSeconds: number;
  soilMoisture: number;
  shouldIrrigate: boolean | number;
  timestamp: string | number | Date;
  action: string;
  status: string;
  reason?: string;
};
