import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SourceEntity } from '../model/source.entity';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [TypeOrmModule.forFeature([SourceEntity]), AuthModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}
