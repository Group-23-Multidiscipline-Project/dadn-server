import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LOG_LEVELS } from '@nestjs/common';

export class SystemLogQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by log level',
    enum: LOG_LEVELS,
    example: 'warn',
  })
  @IsOptional()
  @IsIn(LOG_LEVELS)
  level?: (typeof LOG_LEVELS)[number];

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
