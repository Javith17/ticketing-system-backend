import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalApiClientModule } from '../common/http/external-api-client.module';
import { PublicUserEntity } from '../model/public_user.entity';
import { TicketEntity } from '../model/ticket.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { PublicQrController } from './public-qr.controller';
import { PublicQrService } from './public-qr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublicUserEntity, TicketEntity]),
    TicketsModule,
    ExternalApiClientModule,
  ],
  controllers: [PublicQrController],
  providers: [PublicQrService],
})
export class PublicQrModule {}
