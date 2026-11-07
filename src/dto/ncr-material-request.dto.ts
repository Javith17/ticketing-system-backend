import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { NCR_RETURN_DISPOSITIONS } from '../model/ncr-material-return.entity';

export class MaterialLineDto {
  @IsString()
  @IsNotEmpty()
  material_name: string;

  @IsNumber()
  @Min(0)
  material_qty: number;
}

export class CreateNcrMaterialRequestDto {
  @IsUUID()
  @IsNotEmpty()
  ncr_ticket_id: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MaterialLineDto)
  materials: MaterialLineDto[];
}

export class ApproveMaterialLineDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @Min(0)
  approved_qty: number;
}

export class ApproveNcrMaterialRequestDto {
  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApproveMaterialLineDto)
  materials: ApproveMaterialLineDto[];
}

// Stores issue (process flow step #40). Each row is one issued quantity of
// an approved line; a line may have several rows (one per serial no., or a
// single batch row). Lines without rows are issued as 0.
export class IssueMaterialRowDto {
  @IsUUID()
  @IsNotEmpty()
  detail_id: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsOptional()
  serial_no?: string;

  @IsString()
  @IsOptional()
  batch_no?: string;
}

export class IssueNcrMaterialDto {
  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IssueMaterialRowDto)
  items: IssueMaterialRowDto[];
}

// Technician confirms receipt of the issued material (step #42).
export class ReceiveNcrMaterialDto {
  @IsString()
  @IsOptional()
  remarks?: string;
}

// One failed item the technician returns to Stores (step #43). Sent as a
// JSON string in the multipart 'items' field alongside the photos.
export class ReturnItemDto {
  @IsUUID()
  @IsOptional()
  detail_id?: string;

  @IsString()
  @IsNotEmpty()
  item_name: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsOptional()
  serial_no?: string;

  @IsString()
  @IsOptional()
  batch_no?: string;

  @IsString()
  @IsOptional()
  condition_remarks?: string;
}

// Stores' disposition of each returned item (step #44).
export class DispositionItemDto {
  @IsUUID()
  @IsNotEmpty()
  return_id: string;

  @IsIn(NCR_RETURN_DISPOSITIONS as unknown as string[])
  disposition: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RecordDispositionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispositionItemDto)
  items: DispositionItemDto[];
}
