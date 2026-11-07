import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  category_code: string;

  @IsString()
  @IsNotEmpty()
  category_name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
