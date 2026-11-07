import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, Min, ValidateNested } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export const NCR_ALERT_SCOPES = ['Location', 'Section', 'Pole'] as const;
export type NcrAlertScope = (typeof NCR_ALERT_SCOPES)[number];

export class NcrThresholdItemDto {
  @IsIn(NCR_ALERT_SCOPES)
  scope: NcrAlertScope;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_tickets: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  window_days: number;
}

export class SaveNcrThresholdsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NcrThresholdItemDto)
  thresholds: NcrThresholdItemDto[];
}

export class NcrAlertListDto extends PaginationDto {}
