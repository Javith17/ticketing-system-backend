import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSettingsEntity } from '../model/email-settings.entity';
import { EmailService } from './email.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailSettingsEntity])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
