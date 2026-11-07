import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import { SaveEmailSettingsDto, TestEmailDto } from '../dto/email-settings.dto';
import { EmailSettingsService } from './email-settings.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('email-settings')
export class EmailSettingsController {
  constructor(private readonly emailSettingsService: EmailSettingsService) {}

  @Get()
  getSettings() {
    return this.emailSettingsService.getSettings();
  }

  @Put()
  saveSettings(@Body() dto: SaveEmailSettingsDto) {
    return this.emailSettingsService.saveSettings(dto);
  }

  @Post('test-email')
  testEmail(@Body() dto: TestEmailDto) {
    return this.emailSettingsService.testEmail(dto);
  }
}
