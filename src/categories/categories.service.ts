import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from '../dto/category.dto';
import { CategoryEntity } from '../model/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepo: Repository<CategoryEntity>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const existingByName = await this.categoryRepo.findOne({
      where: { category_name: createCategoryDto.category_name },
    });
    if (existingByName) {
      throw new HttpException(
        'Category name already exists',
        HttpStatus.CONFLICT,
      );
    }

    const existingByCode = await this.categoryRepo.findOne({
      where: { category_code: createCategoryDto.category_code },
    });
    if (existingByCode) {
      throw new HttpException(
        'Category code already exists',
        HttpStatus.CONFLICT,
      );
    }

    const category = await this.categoryRepo.save(createCategoryDto);
    return { message: 'Category created successfully', data: category };
  }

  async findAll() {
    const data = await this.categoryRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
    return { message: 'Categories fetched successfully', data };
  }
}
