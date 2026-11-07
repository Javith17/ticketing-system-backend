import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  App,
  cert,
  getApp,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { RoleEntity } from '../model/role.entity';
import { UserEntity } from '../model/user.entity';

// Sends FCM push notifications to users' registered device tokens. Requires a
// Firebase service account (Project Settings -> Service Accounts -> Generate
// new private key) - this is NOT the google-services.json used by the Android
// app. Configure via FIREBASE_SERVICE_ACCOUNT_JSON (inline JSON) or
// FIREBASE_SERVICE_ACCOUNT_PATH (path to the downloaded key file). Without
// either, every send call logs a warning and no-ops instead of failing the
// caller's request.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly app: App | null;

  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private roleRepo: Repository<RoleEntity>,
    private emailService: EmailService,
  ) {
    this.app = this.initFirebaseApp();
  }

  private initFirebaseApp(): App | null {
    try {
      const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

      let serviceAccount: ServiceAccount | undefined;
      if (inlineJson) {
        serviceAccount = JSON.parse(inlineJson);
      } else if (path && fs.existsSync(path)) {
        serviceAccount = JSON.parse(fs.readFileSync(path, 'utf-8'));
      }

      if (!serviceAccount) {
        this.logger.warn(
          'Firebase service account not configured (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH) - push notifications are disabled',
        );
        return null;
      }

      return getApps().length
        ? getApp()
        : initializeApp({ credential: cert(serviceAccount) });
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      return null;
    }
  }

  async sendToUser(
    userId: string | null | undefined,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!userId) return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    await this.notifyUser(user, title, body, data);
  }

  async sendToRoleCode(
    roleCode: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { role_code: roleCode },
    });
    if (!role) return;

    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('user.role_id = :roleId', { roleId: role.id })
      .andWhere('user.is_active = :isActive', { isActive: true })
      .getMany();

    await Promise.all(
      users.map((user) => this.notifyUser(user, title, body, data)),
    );
  }

  // Delivers both channels for a single resolved user - FCM push (if a
  // device token is registered) and email (if configured) - reusing the same
  // user row for both instead of querying twice. Neither channel blocks the
  // other or the caller: failures are logged and swallowed.
  private async notifyUser(
    user: UserEntity,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (user.notification_token) {
      tasks.push(this.sendToToken(user.notification_token, title, body, data));
    }
    if (user.email) {
      tasks.push(this.emailService.sendMail(user.email, title, body));
    }

    await Promise.all(tasks);
  }

  private async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.app) return;

    try {
      await getMessaging(this.app).send({
        token,
        notification: { title, body },
        data,
      });
    } catch (error) {
      // An invalid/expired token shouldn't fail the ticket action that
      // triggered the notification - just log it.
      this.logger.warn(`Failed to send push notification: ${error.message}`);
    }
  }
}
