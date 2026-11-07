import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveEmailSettingsDto {
  @IsEmail()
  @IsNotEmpty()
  email_id: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class TestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsEmail()
  @IsOptional()
  email_id?: string;

  @IsString()
  @IsOptional()
  password?: string;
}
