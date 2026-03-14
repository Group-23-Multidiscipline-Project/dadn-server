import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SystemLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by device id',
    example: 'node_01',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by event type',
    example: 'CHAIN_STATE_CHANGED',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Filter by trace id',
    example: '0c8feb18-42b3-4c38-97ab-21c3d264ee79',
  })
  @IsOptional()
  @IsString()
  traceId?: string;

  @ApiPropertyOptional({
    description: 'Start date-time in ISO 8601 format (filter by occurredAt)',
    example: '2026-03-14T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date-time in ISO 8601 format (filter by occurredAt)',
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
