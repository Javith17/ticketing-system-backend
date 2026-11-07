import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

export class CreatePublicUserDto {
  @IsEmail()
  @IsNotEmpty()
  email_id: string;
}

export class UpdatePublicUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;
}

export class GetPublicUserByEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class CreateTicketFromQrDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  pole_id: number;

  @IsString()
  @IsNotEmpty()
  pole_name: string;

  @IsString()
  @IsNotEmpty()
  location_name: string;

  @IsString()
  @IsNotEmpty()
  section_name: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  location_id?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  section_id?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;

  // Retained for backward compatibility with pre-migration clients; no
  // longer required and not set by current QR-scan clients.
  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @IsUUID()
  @IsOptional()
  public_user_id?: string;

  @IsString()
  @IsNotEmpty()
  issue: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

export class GetTicketsByPublicUserDto extends PaginationDto {
  @IsUUID()
  @IsNotEmpty()
  public_user_id: string;
}
