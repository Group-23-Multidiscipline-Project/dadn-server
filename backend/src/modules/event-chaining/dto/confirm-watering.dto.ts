import { IsOptional, IsString } from 'class-validator';

export class ConfirmWateringDto {
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  state?: string;
}
