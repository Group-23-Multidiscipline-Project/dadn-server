import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SensorPushDto {
  @IsString()
  deviceId: string;

  /** Soil moisture: raw ADC 12-bit (inverted: high = dry) */
  @IsNumber()
  @Min(0)
  @Max(4095)
  soilMoisture: number;

  /** Light: raw ADC 12-bit (direct: high = bright) */
  @IsNumber()
  @Min(0)
  @Max(4095)
  light: number;

  /** Species name matching SpeciesThreshold.speciesName (default: Tomato) */
  @IsOptional()
  @IsString()
  speciesName?: string;
}
