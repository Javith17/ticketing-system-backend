import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSourceDto } from '../dto/source.dto';
import { SourceEntity } from '../model/source.entity';

@Injectable()
export class SourcesService {
  constructor(
    @InjectRepository(SourceEntity)
    private sourceRepo: Repository<SourceEntity>,
  ) {}

  async create(createSourceDto: CreateSourceDto) {
    const existing = await this.sourceRepo.findOne({
      where: { source_name: createSourceDto.source_name },
    });
    if (existing) {
      throw new HttpException('Source already exists', HttpStatus.CONFLICT);
    }

    const source = await this.sourceRepo.save(createSourceDto);
    return { message: 'Source created successfully', data: source };
  }

  async findAll() {
    const data = await this.sourceRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
    return { message: 'Sources fetched successfully', data };
  }
}
