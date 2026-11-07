import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import { CreateSourceDto } from '../dto/source.dto';
import { SourcesService } from './sources.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Post()
  create(@Body() createSourceDto: CreateSourceDto) {
    return this.sourcesService.create(createSourceDto);
  }

  @Get()
  findAll() {
    return this.sourcesService.findAll();
  }
}
