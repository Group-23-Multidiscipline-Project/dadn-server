import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChainState } from '../../../schemas/device-state.schema';

export class EventLogQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by device id',
    example: 'node_01',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by topic',
    example: 'yolofarm/node_01/sensors/light',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Filter by state',
    enum: ChainState,
    example: ChainState.WATERING,
  })
  @IsOptional()
  @IsEnum(ChainState)
  state?: ChainState;

  @ApiPropertyOptional({
    description: 'Filter by action',
    example: 'start_pump',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Start date-time in ISO 8601 format',
    example: '2026-03-14T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date-time in ISO 8601 format',
    example: '2026-03-14T11:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of records to return',
    minimum: 1,
    maximum: 1000,
    default: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 200;
}
