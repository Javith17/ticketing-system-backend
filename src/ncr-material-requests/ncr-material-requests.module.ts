import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NcrMaterialIssueEntity } from '../model/ncr-material-issue.entity';
import { NcrMaterialRequestDetailEntity } from '../model/ncr-material-request-detail.entity';
import { NcrMaterialRequestEntity } from '../model/ncr-material-request.entity';
import { NcrMaterialReturnEntity } from '../model/ncr-material-return.entity';
import { NcrTicketEntity } from '../model/ncr-ticket.entity';
import { UserEntity } from '../model/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { NcrMaterialRequestsController } from './ncr-material-requests.controller';
import { NcrMaterialRequestsService } from './ncr-material-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NcrMaterialRequestEntity,
      NcrMaterialRequestDetailEntity,
      NcrTicketEntity,
      NcrMaterialIssueEntity,
      NcrMaterialReturnEntity,
      UserEntity,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [NcrMaterialRequestsController],
  providers: [NcrMaterialRequestsService],
})
export class NcrMaterialRequestsModule {}
