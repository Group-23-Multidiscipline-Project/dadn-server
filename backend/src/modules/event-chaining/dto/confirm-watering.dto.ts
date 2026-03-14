import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmWateringDto {
  @ApiProperty({ example: 'device_01', description: 'ID định danh thiết bị' })
  @IsString()
  deviceId: string;

  @ApiPropertyOptional({
    example: 'WATERING done',
    description: 'Trạng thái báo về từ device (tuỳ chọn)',
  })
  @IsOptional()
  @IsString()
  state?: string;
}
