import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class LocationsListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  limit: number;

  @IsOptional()
  @IsString()
  searchText?: string;
}

export class SectionsListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  limit: number;

  @IsOptional()
  @IsString()
  searchText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;
}

export class PolesListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  limit: number;

  @IsOptional()
  @IsString()
  searchText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;
}

export class QrCodeLookupDto {
  @IsString()
  @IsNotEmpty()
  qrcode: string;
}
