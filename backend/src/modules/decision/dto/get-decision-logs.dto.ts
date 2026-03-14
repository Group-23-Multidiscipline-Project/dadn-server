import { IsIn, IsInt, IsOptional, IsPositive, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDecisionLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsIn(['pending', 'displayed', 'acknowledged'])
  status?: 'pending' | 'displayed' | 'acknowledged';
}
