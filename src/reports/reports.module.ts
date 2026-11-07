import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NcrAlertLogEntity } from '../model/ncr-alert-log.entity';
import { NcrTicketEntity } from '../model/ncr-ticket.entity';
import { TicketEntity } from '../model/ticket.entity';
import { TicketDetailsEntity } from '../model/ticket_details.entity';
import { TicketHistoryEntity } from '../model/ticket_history.entity';
import { UserEntity } from '../model/user.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketEntity,
      TicketHistoryEntity,
      TicketDetailsEntity,
      NcrTicketEntity,
      NcrAlertLogEntity,
      UserEntity,
    ]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
