import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateFeatureDto,
  FeatureListDto,
  UpdateFeatureDto,
} from '../dto/feature.dto';
import { FeatureEntity } from '../model/feature.entity';

@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(FeatureEntity)
    private featureRepo: Repository<FeatureEntity>,
  ) {}

  async create(createFeatureDto: CreateFeatureDto) {
    await this.ensureFeatureNameNotTaken(createFeatureDto.feature);
    const feature = await this.featureRepo.save(createFeatureDto);
    return { message: 'Feature created successfully', data: feature };
  }

  async findAll(listDto: FeatureListDto) {
    const page = listDto.page || 1;
    const limit = listDto.limit || 20;

    const query = this.featureRepo
      .createQueryBuilder('feature')
      .where('feature.is_active = :isActive', { isActive: true })
      .orderBy('feature.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (listDto.search) {
      query.andWhere('LOWER(feature.feature) LIKE :search', {
        search: `%${listDto.search.toLowerCase()}%`,
      });
    }

    const [data, total] = await query.getManyAndCount();
    return {
      message: 'Features fetched successfully',
      data,
      total,
      page,
      limit,
    };
  }

  async update(id: string, updateFeatureDto: UpdateFeatureDto) {
    const existing = await this.featureRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Feature not found', HttpStatus.NOT_FOUND);
    }

    if (
      updateFeatureDto.feature &&
      updateFeatureDto.feature !== existing.feature
    ) {
      await this.ensureFeatureNameNotTaken(updateFeatureDto.feature);
    }

    await this.featureRepo.update(id, updateFeatureDto);
    const updated = await this.featureRepo.findOne({ where: { id } });
    return { message: 'Feature updated successfully', data: updated };
  }

  private async ensureFeatureNameNotTaken(feature: string) {
    const existing = await this.featureRepo.findOne({ where: { feature } });
    if (existing) {
      throw new HttpException('Feature already exists', HttpStatus.CONFLICT);
    }
  }
}
