import { Module } from '@nestjs/common';
import { ExternalApiClientService } from './external-api-client.service';

@Module({
  providers: [ExternalApiClientService],
  exports: [ExternalApiClientService],
})
export class ExternalApiClientModule {}
