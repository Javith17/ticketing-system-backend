import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { decryptSecret } from '../common/utils/crypto.util';
import { EmailSettingsEntity } from '../model/email-settings.entity';

export interface AdHocEmailCredentials {
  email_id: string;
  password: string;
}

// Sends outgoing email (ticket/NCR notifications, plus the Settings > Email
// Settings test button). Requires a saved email_settings row (Email Id +
// Password, configured via PUT /email-settings) - without one, sendMail logs
// a warning and no-ops, mirroring NotificationsService's Firebase-not-
// configured behaviour. SMTP host/port default to Gmail and are overridable
// via SMTP_HOST/SMTP_PORT since the UI only collects Email Id + Password.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(EmailSettingsEntity)
    private emailSettingsRepo: Repository<EmailSettingsEntity>,
  ) {}

  /**
   * Best-effort email send - never throws. Used by NotificationsService so a
   * mail failure (or missing configuration) can never block the ticket/NCR
   * action that triggered it.
   */
  async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!to) return;

    const settings = await this.getActiveSettings();
    if (!settings) {
      this.logger.warn(
        'Email settings not configured (Settings > Email Settings) - skipping email send',
      );
      return;
    }

    try {
      const password = decryptSecret(settings.email_password_encrypted);
      const transporter = this.buildTransporter(settings.email_id, password);
      await transporter.sendMail({
        from: settings.email_id,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.warn(`Failed to send email to ${to}: ${error.message}`);
    }
  }

  /**
   * Used by POST /email-settings/test-email. Unlike sendMail, this reports
   * success/failure back to the caller instead of swallowing errors, since
   * the UI needs to show a pass/fail result either way.
   */
  async sendTestMail(
    to: string,
    credentials?: AdHocEmailCredentials,
  ): Promise<{ success: boolean; message: string }> {
    try {
      let emailId: string;
      let password: string;

      if (credentials?.email_id && credentials?.password) {
        emailId = credentials.email_id;
        password = credentials.password;
      } else {
        const settings = await this.getActiveSettings();
        if (!settings) {
          return {
            success: false,
            message: 'Email settings are not configured',
          };
        }
        emailId = settings.email_id;
        password = decryptSecret(settings.email_password_encrypted);
      }

      const transporter = this.buildTransporter(emailId, password);
      await transporter.sendMail({
        from: emailId,
        to,
        subject: 'Test Email',
        html: 'This is a test email from the Ticketing System.',
      });

      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to send test email',
      };
    }
  }

  private async getActiveSettings(): Promise<EmailSettingsEntity | null> {
    return this.emailSettingsRepo.findOne({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  private buildTransporter(emailId: string, password: string) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
      host,
      port,
      secure: false, // STARTTLS on 587
      auth: { user: emailId, pass: password },
    });
  }
}
