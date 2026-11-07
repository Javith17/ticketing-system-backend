import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { EmailSettingsModule } from './email-settings/email-settings.module';
import { FeaturesModule } from './features/features.module';
import { MasterDetailsModule } from './master-details/master-details.module';
import { AssetEntity } from './model/asset.entity';
import { CategoryEntity } from './model/category.entity';
import { EmailSettingsEntity } from './model/email-settings.entity';
import { FeatureEntity } from './model/feature.entity';
import { NcrMaterialIssueEntity } from './model/ncr-material-issue.entity';
import { NcrMaterialRequestDetailEntity } from './model/ncr-material-request-detail.entity';
import { NcrMaterialRequestEntity } from './model/ncr-material-request.entity';
import { NcrMaterialReturnEntity } from './model/ncr-material-return.entity';
import { NcrAlertLogEntity } from './model/ncr-alert-log.entity';
import { NcrAlertThresholdEntity } from './model/ncr-alert-threshold.entity';
import { NcrTicketEntity } from './model/ncr-ticket.entity';
import { PublicUserEntity } from './model/public_user.entity';
import { RoleEntity } from './model/role.entity';
import { SourceEntity } from './model/source.entity';
import { TicketEntity } from './model/ticket.entity';
import { TicketDetailsEntity } from './model/ticket_details.entity';
import { TicketHistoryEntity } from './model/ticket_history.entity';
import { UserEntity } from './model/user.entity';
import { NcrAlertsModule } from './ncr-alerts/ncr-alerts.module';
import { NcrMaterialRequestsModule } from './ncr-material-requests/ncr-material-requests.module';
import { NcrTicketsModule } from './ncr-tickets/ncr-tickets.module';
import { PublicQrModule } from './public-qr/public-qr.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SourcesModule } from './sources/sources.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      username: process.env.PG_USERNAME,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DB,
      entities: [
        UserEntity,
        RoleEntity,
        FeatureEntity,
        SourceEntity,
        CategoryEntity,
        AssetEntity,
        PublicUserEntity,
        TicketEntity,
        TicketHistoryEntity,
        TicketDetailsEntity,
        NcrTicketEntity,
        NcrMaterialRequestEntity,
        NcrMaterialRequestDetailEntity,
        NcrMaterialIssueEntity,
        NcrMaterialReturnEntity,
        EmailSettingsEntity,
        NcrAlertThresholdEntity,
        NcrAlertLogEntity,
      ],
      synchronize: false,
      ssl:
        process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    FeaturesModule,
    SourcesModule,
    CategoriesModule,
    AssetsModule,
    PublicQrModule,
    TicketsModule,
    NcrTicketsModule,
    NcrMaterialRequestsModule,
    EmailSettingsModule,
    MasterDetailsModule,
    NcrAlertsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
