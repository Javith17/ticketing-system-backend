import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NcrTicketEntity } from '../model/ncr-ticket.entity';
import { RoleEntity } from '../model/role.entity';
import { TicketEntity } from '../model/ticket.entity';
import { UserEntity } from '../model/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { NcrTicketsController } from './ncr-tickets.controller';
import { NcrTicketsService } from './ncr-tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NcrTicketEntity,
      TicketEntity,
      UserEntity,
      RoleEntity,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [NcrTicketsController],
  providers: [NcrTicketsService],
  exports: [NcrTicketsService],
})
export class NcrTicketsModule {}
