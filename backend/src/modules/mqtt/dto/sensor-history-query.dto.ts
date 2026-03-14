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

export class SensorHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by node id',
    example: 'node_01',
  })
  @IsOptional()
  @IsString()
  nodeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sensor key',
    example: 'soil_moisture',
  })
  @IsOptional()
  @IsString()
  sensor?: string;

  @ApiPropertyOptional({
    description: 'Start date-time in ISO 8601 format',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date-time in ISO 8601 format',
    example: '2026-03-12T23:59:59.999Z',
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
