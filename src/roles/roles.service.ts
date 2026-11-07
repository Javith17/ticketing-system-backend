import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoleDto, RoleListDto, UpdateRoleDto } from '../dto/role.dto';
import { RoleEntity } from '../model/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity) private roleRepo: Repository<RoleEntity>,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    await this.ensureRoleCodeNotTaken(createRoleDto.role_code);
    await this.ensureRoleNameNotTaken(createRoleDto.role_name);

    const role = await this.roleRepo.save({
      ...createRoleDto,
      features: createRoleDto.features || [],
      approvals: createRoleDto.approvals || [],
    });
    return { message: 'Role created successfully', data: role };
  }

  async findAll(listDto: RoleListDto) {
    const query = this.roleRepo
      .createQueryBuilder('role')
      .where('role.is_active = :isActive', { isActive: true })
      .orderBy('role.created_at', 'DESC');

    if (listDto.search) {
      query.andWhere('LOWER(role.role_name) LIKE :search', {
        search: `%${listDto.search.toLowerCase()}%`,
      });
    }

    if (listDto.feature) {
      query.andWhere('role.features::text ILIKE :feature', {
        feature: `%${listDto.feature}%`,
      });
    }

    if (listDto.page) {
      const page = listDto.page;
      const limit = listDto.limit || 20;
      query.skip((page - 1) * limit).take(limit);

      const [data, total] = await query.getManyAndCount();
      return {
        message: 'Roles fetched successfully',
        data,
        total,
        page,
        limit,
      };
    }

    const data = await query.getMany();
    return { message: 'Roles fetched successfully', data };
  }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Role fetched successfully', data: role };
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const existing = await this.roleRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }

    if (
      updateRoleDto.role_name &&
      updateRoleDto.role_name !== existing.role_name
    ) {
      await this.ensureRoleNameNotTaken(updateRoleDto.role_name);
    }

    await this.roleRepo.update(id, updateRoleDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.roleRepo.update(id, { is_active: false });
    return { message: 'Role deactivated successfully' };
  }

  private async ensureRoleCodeNotTaken(roleCode: string) {
    const existing = await this.roleRepo.findOne({
      where: { role_code: roleCode },
    });
    if (existing) {
      throw new HttpException('Role code already exists', HttpStatus.CONFLICT);
    }
  }

  private async ensureRoleNameNotTaken(roleName: string) {
    const existing = await this.roleRepo.findOne({
      where: { role_name: roleName },
    });
    if (existing) {
      throw new HttpException('Role name already exists', HttpStatus.CONFLICT);
    }
  }
}
