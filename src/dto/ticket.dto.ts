import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

export class CreateTicketDto {
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
  // longer required and not set by current web/mobile clients.
  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @IsString()
  @IsNotEmpty()
  issue: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @IsDateString()
  @IsOptional()
  due_at?: string;
}

export class UpdateTicketDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  pole_id?: number;

  @IsString()
  @IsOptional()
  pole_name?: string;

  @IsString()
  @IsOptional()
  location_name?: string;

  @IsString()
  @IsOptional()
  section_name?: string;

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

  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @IsString()
  @IsOptional()
  issue?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @IsDateString()
  @IsOptional()
  due_at?: string;
}

export class UpdateTicketStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class AssignRsmDto {
  @IsUUID()
  @IsNotEmpty()
  assigned_rsm: string;
}

export class AssignTechnicianDto {
  @IsUUID()
  @IsNotEmpty()
  assigned_to: string;
}

export class StartWorkDto {
  @IsString()
  @IsNotEmpty()
  remarks: string;
}

export class ApproveClosureDto {
  @IsString()
  @IsNotEmpty()
  remarks: string;
}

export class TicketListDto extends PaginationDto {
  // Legacy filters, kept for querying pre-migration tickets.
  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  location_id?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  section_id?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  pole_id?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @IsDateString()
  @IsOptional()
  created_from?: string;

  @IsDateString()
  @IsOptional()
  created_to?: string;
}
