import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  feature: string;

  @IsBoolean()
  @IsOptional()
  is_approval?: boolean;
}

export class UpdateFeatureDto {
  @IsString()
  @IsOptional()
  feature?: string;

  @IsBoolean()
  @IsOptional()
  is_approval?: boolean;
}

export class FeatureListDto extends PaginationDto {}
