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
import { CreateCategoryDto } from '../dto/category.dto';
import { CategoriesService } from './categories.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }
}
