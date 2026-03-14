import { IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SensorDataDto {
  @ApiProperty({ example: 'device_01', description: 'ID định danh thiết bị' })
  @IsString()
  deviceId: string;

  @ApiProperty({
    example: 15,
    minimum: 0,
    maximum: 100,
    description: 'Độ ẩm (%). Ngưỡng kích hoạt: < 20',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  humidity: number;

  @ApiProperty({
    example: 600,
    minimum: 0,
    description: 'Cường độ ánh sáng (lux). Ngưỡng kích hoạt: > 500',
  })
  @IsNumber()
  @Min(0)
  light: number;
}
