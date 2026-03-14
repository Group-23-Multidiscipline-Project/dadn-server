import { IsNumber, IsString, Max, Min } from 'class-validator';

export class SensorDataDto {
  @IsString()
  deviceId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  humidity: number;

  @IsNumber()
  @Min(0)
  light: number;
}
