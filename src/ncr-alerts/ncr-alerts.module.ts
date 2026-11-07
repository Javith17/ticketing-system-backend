import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NcrAlertLogEntity } from '../model/ncr-alert-log.entity';
import { NcrAlertThresholdEntity } from '../model/ncr-alert-threshold.entity';
import { TicketEntity } from '../model/ticket.entity';
import { NcrTicketsModule } from '../ncr-tickets/ncr-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NcrAlertsController } from './ncr-alerts.controller';
import { NcrAlertsService } from './ncr-alerts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NcrAlertThresholdEntity,
      NcrAlertLogEntity,
      TicketEntity,
    ]),
    AuthModule,
    NotificationsModule,
    NcrTicketsModule,
  ],
  controllers: [NcrAlertsController],
  providers: [NcrAlertsService],
  exports: [NcrAlertsService],
})
export class NcrAlertsModule {}
