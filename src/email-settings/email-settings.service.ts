import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { encryptSecret } from '../common/utils/crypto.util';
import { EmailService } from '../email/email.service';
import { SaveEmailSettingsDto, TestEmailDto } from '../dto/email-settings.dto';
import { EmailSettingsEntity } from '../model/email-settings.entity';

@Injectable()
export class EmailSettingsService {
  constructor(
    @InjectRepository(EmailSettingsEntity)
    private emailSettingsRepo: Repository<EmailSettingsEntity>,
    private emailService: EmailService,
  ) {}

  async getSettings() {
    const existing = await this.findActive();
    return {
      message: 'Email settings fetched successfully',
      data: {
        email_id: existing?.email_id ?? null,
        is_configured: !!existing,
      },
    };
  }

  async saveSettings(dto: SaveEmailSettingsDto) {
    const encrypted = encryptSecret(dto.password);
    const existing = await this.findActive();

    if (existing) {
      await this.emailSettingsRepo.update(existing.id, {
        email_id: dto.email_id,
        email_password_encrypted: encrypted,
      });
    } else {
      await this.emailSettingsRepo.save({
        email_id: dto.email_id,
        email_password_encrypted: encrypted,
      });
    }

    return {
      message: 'Email settings saved successfully',
      data: { email_id: dto.email_id, is_configured: true },
    };
  }

  // Not wrapped in the usual {message, data} envelope - the UI needs a
  // pass/fail result either way, so failures are returned, not thrown.
  async testEmail(
    dto: TestEmailDto,
  ): Promise<{ success: boolean; message: string }> {
    const credentials =
      dto.email_id && dto.password
        ? { email_id: dto.email_id, password: dto.password }
        : undefined;

    return this.emailService.sendTestMail(dto.to, credentials);
  }

  private async findActive(): Promise<EmailSettingsEntity | null> {
    return this.emailSettingsRepo.findOne({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }
}
