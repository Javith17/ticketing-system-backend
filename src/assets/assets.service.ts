import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import {
  AssetListDto,
  AssetLookupDto,
  CreateAssetDto,
  UpdateAssetDto,
} from '../dto/asset.dto';
import { AssetEntity } from '../model/asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AssetEntity) private assetRepo: Repository<AssetEntity>,
  ) {}

  async create(createAssetDto: CreateAssetDto) {
    await this.ensureNoDuplicateCombination(
      createAssetDto.asset_name,
      createAssetDto.panel,
      createAssetDto.location,
    );

    const barcode =
      createAssetDto.barcode ||
      this.generateBarcode(
        createAssetDto.asset_name,
        createAssetDto.panel,
        createAssetDto.location,
      );

    if (createAssetDto.barcode) {
      await this.ensureBarcodeNotTaken(createAssetDto.barcode);
    }

    const asset = await this.assetRepo.save({ ...createAssetDto, barcode });
    return { message: 'Asset created successfully', data: asset };
  }

  async findAll(listDto: AssetListDto) {
    const page = listDto.page || 1;
    const limit = listDto.limit || 20;

    const query = this.assetRepo
      .createQueryBuilder('asset')
      .where('asset.is_active = :isActive', { isActive: true })
      .orderBy('asset.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (listDto.search) {
      query.andWhere('LOWER(asset.asset_name) LIKE :search', {
        search: `%${listDto.search.toLowerCase()}%`,
      });
    }

    if (listDto.location) {
      query.andWhere('asset.location = :location', {
        location: listDto.location,
      });
    }

    if (listDto.panel) {
      query.andWhere('asset.panel = :panel', { panel: listDto.panel });
    }

    const [data, total] = await query.getManyAndCount();
    return { message: 'Assets fetched successfully', data, total, page, limit };
  }

  async findByIdOrBarcode(lookupDto: AssetLookupDto) {
    const asset = lookupDto.asset_id
      ? await this.assetRepo.findOne({ where: { id: lookupDto.asset_id } })
      : await this.assetRepo.findOne({ where: { barcode: lookupDto.barcode } });

    if (!asset) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Asset fetched successfully', data: asset };
  }

  async update(id: string, updateAssetDto: UpdateAssetDto) {
    const existing = await this.assetRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }

    const nextAssetName = updateAssetDto.asset_name ?? existing.asset_name;
    const nextPanel = updateAssetDto.panel ?? existing.panel;
    const nextLocation = updateAssetDto.location ?? existing.location;

    if (
      updateAssetDto.asset_name !== undefined ||
      updateAssetDto.panel !== undefined ||
      updateAssetDto.location !== undefined
    ) {
      await this.ensureNoDuplicateCombination(
        nextAssetName,
        nextPanel,
        nextLocation,
        id,
      );
    }

    if (updateAssetDto.barcode && updateAssetDto.barcode !== existing.barcode) {
      await this.ensureBarcodeNotTaken(updateAssetDto.barcode);
    }

    const updatePayload: Partial<AssetEntity> = { ...updateAssetDto };
    await this.assetRepo.update(id, updatePayload);
    const updated = await this.assetRepo.findOne({ where: { id } });
    return { message: 'Asset updated successfully', data: updated };
  }

  private generateBarcode(
    assetName: string,
    panel: string,
    location: string,
  ): string {
    const raw = `${assetName}|${panel}|${location}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async ensureNoDuplicateCombination(
    assetName: string,
    panel: string,
    location: string,
    excludeId?: string,
  ) {
    const query = this.assetRepo
      .createQueryBuilder('asset')
      .where('asset.asset_name = :assetName', { assetName })
      .andWhere('asset.panel = :panel', { panel })
      .andWhere('asset.location = :location', { location });

    if (excludeId) {
      query.andWhere('asset.id != :excludeId', { excludeId });
    }

    const existing = await query.getOne();
    if (existing) {
      throw new HttpException(
        'An asset with the same name, panel and location already exists',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async ensureBarcodeNotTaken(barcode: string) {
    const existing = await this.assetRepo.findOne({ where: { barcode } });
    if (existing) {
      throw new HttpException('Barcode already in use', HttpStatus.CONFLICT);
    }
  }
}
