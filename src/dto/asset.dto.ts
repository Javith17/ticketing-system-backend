import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  asset_name: string;

  @IsString()
  @IsNotEmpty()
  panel: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsObject()
  @IsOptional()
  coordinates?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  barcode?: string;
}

export class UpdateAssetDto {
  @IsString()
  @IsOptional()
  asset_name?: string;

  @IsString()
  @IsOptional()
  panel?: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsObject()
  @IsOptional()
  coordinates?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  barcode?: string;
}

export class AssetListDto extends PaginationDto {
  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  panel?: string;
}

export class AssetLookupDto {
  @ValidateIf((dto: AssetLookupDto) => !dto.barcode)
  @IsUUID(undefined, { message: 'asset_id must be a UUID' })
  @IsNotEmpty({ message: 'Either asset_id or barcode must be provided' })
  asset_id?: string;

  @ValidateIf((dto: AssetLookupDto) => !dto.asset_id)
  @IsString()
  @IsNotEmpty({ message: 'Either asset_id or barcode must be provided' })
  barcode?: string;
}
