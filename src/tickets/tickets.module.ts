import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AssetEntity } from '../model/asset.entity';
import { TicketEntity } from '../model/ticket.entity';
import { TicketDetailsEntity } from '../model/ticket_details.entity';
import { TicketHistoryEntity } from '../model/ticket_history.entity';
import { UserEntity } from '../model/user.entity';
import { NcrAlertsModule } from '../ncr-alerts/ncr-alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketHistoryService } from './ticket-history.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketEntity,
      AssetEntity,
      UserEntity,
      TicketHistoryEntity,
      TicketDetailsEntity,
    ]),
    AuthModule,
    NotificationsModule,
    NcrAlertsModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, TicketHistoryService],
  exports: [TicketHistoryService],
})
export class TicketsModule {}
