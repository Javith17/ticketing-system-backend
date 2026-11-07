import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import {
  CreateFeatureDto,
  FeatureListDto,
  UpdateFeatureDto,
} from '../dto/feature.dto';
import { FeaturesService } from './features.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Post()
  create(@Body() createFeatureDto: CreateFeatureDto) {
    return this.featuresService.create(createFeatureDto);
  }

  @Get()
  findAll(@Query() listDto: FeatureListDto) {
    return this.featuresService.findAll(listDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFeatureDto: UpdateFeatureDto) {
    return this.featuresService.update(id, updateFeatureDto);
  }
}
