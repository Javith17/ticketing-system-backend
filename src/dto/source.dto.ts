import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSourceDto {
  @IsString()
  @IsNotEmpty()
  source_name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
