import { IsNumber } from 'class-validator';

export class SensorValueDto {
  @IsNumber()
  value: number;
}
