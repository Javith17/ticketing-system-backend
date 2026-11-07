import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExternalApiClientModule } from '../common/http/external-api-client.module';
import { MasterDetailsController } from './master-details.controller';
import { MasterDetailsService } from './master-details.service';

@Module({
  imports: [ExternalApiClientModule, AuthModule],
  controllers: [MasterDetailsController],
  providers: [MasterDetailsService],
})
export class MasterDetailsModule {}
