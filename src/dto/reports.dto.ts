import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class DateRangeDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}

export class HotspotReportDto extends DateRangeDto {
  @IsIn(['location', 'section', 'pole'])
  scope: 'location' | 'section' | 'pole';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  parent_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}

export class OverdueReportDto extends DateRangeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class ResolutionWorkloadReportDto extends DateRangeDto {
  @IsIn(['priority', 'source', 'location'])
  @IsOptional()
  group_by?: 'priority' | 'source' | 'location';
}

export class NcrHotspotReportDto extends DateRangeDto {
  @IsIn(['location', 'section', 'pole'])
  scope: 'location' | 'section' | 'pole';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  parent_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}

export class AlertBreachHistoryDto extends DateRangeDto {
  @IsIn(['Location', 'Section', 'Pole'])
  @IsOptional()
  scope?: 'Location' | 'Section' | 'Pole';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
