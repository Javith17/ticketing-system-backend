import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  role_name: string;

  @IsString()
  @IsNotEmpty()
  role_code: string;

  @IsArray()
  @IsOptional()
  features?: any[];

  @IsArray()
  @IsOptional()
  approvals?: any[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  role_name?: string;

  @IsArray()
  @IsOptional()
  features?: any[];

  @IsArray()
  @IsOptional()
  approvals?: any[];
}

export class RoleListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  feature?: string;
}
