import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { ChangePasswordDto } from '../dto/auth.dto';
import {
  CreateUserDto,
  UpdateNotificationTokenDto,
  UpdateUserDto,
  UserListDto,
} from '../dto/user.dto';
import { RoleEntity } from '../model/role.entity';
import { UserEntity } from '../model/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

const USER_LIST_COLUMNS = [
  'user.id',
  'user.employee_code',
  'user.first_name',
  'user.last_name',
  'user.full_name',
  'user.email',
  'user.designation',
  'user.role_id',
  'user.phone',
  'user.is_active',
  'user.created_at',
  'user.updated_at',
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private roleRepo: Repository<RoleEntity>,
    private notificationsService: NotificationsService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const role = await this.roleRepo.findOne({
      where: { id: createUserDto.role_id },
    });
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }

    await this.ensureEmailNotTaken(createUserDto.email);
    await this.ensureEmployeeCodeNotTaken(createUserDto.employee_code);

    // The employee code is the default password for a newly created user.
    const hashedPassword = await bcrypt.hash(createUserDto.employee_code, 10);
    const fullName = [createUserDto.first_name, createUserDto.last_name]
      .filter(Boolean)
      .join(' ');

    const user = await this.userRepo.save({
      ...createUserDto,
      full_name: fullName,
      password: hashedPassword,
    });

    return { message: 'User created successfully', data: this.sanitize(user) };
  }

  async findAll(listDto: UserListDto) {
    const page = listDto.page || 1;
    const limit = listDto.limit || 20;

    const query = this.userRepo
      .createQueryBuilder('user')
      .select(USER_LIST_COLUMNS)
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (listDto.search) {
      query.andWhere(
        '(LOWER(user.first_name) LIKE :search OR LOWER(user.last_name) LIKE :search)',
        { search: `%${listDto.search.toLowerCase()}%` },
      );
    }

    if (listDto.designation) {
      query.andWhere('user.designation = :designation', {
        designation: listDto.designation,
      });
    }

    if (listDto.role_id) {
      query.andWhere('user.role_id = :roleId', { roleId: listDto.role_id });
    }

    if (listDto.role_code) {
      query
        .leftJoin(RoleEntity, 'role', 'role.id = user.role_id')
        .andWhere('role.role_code = :roleCode', {
          roleCode: listDto.role_code,
        });
    }

    const [data, total] = await query.getManyAndCount();
    return { message: 'Users fetched successfully', data, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'User fetched successfully', data: this.sanitize(user) };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const existing = await this.userRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (updateUserDto.email && updateUserDto.email !== existing.email) {
      await this.ensureEmailNotTaken(updateUserDto.email);
    }

    if (updateUserDto.role_id) {
      const role = await this.roleRepo.findOne({
        where: { id: updateUserDto.role_id },
      });
      if (!role) {
        throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
      }
    }

    const updatePayload: Partial<UserEntity> = { ...updateUserDto };
    if (updateUserDto.first_name || updateUserDto.last_name) {
      updatePayload.full_name = [
        updateUserDto.first_name ?? existing.first_name,
        updateUserDto.last_name ?? existing.last_name,
      ]
        .filter(Boolean)
        .join(' ');
    }

    await this.userRepo.update(id, updatePayload);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.userRepo.update(id, { is_active: false });
    return { message: 'User deactivated successfully' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const currentMatches = await bcrypt.compare(
      changePasswordDto.current_password,
      user.password,
    );
    if (!currentMatches) {
      throw new HttpException(
        'Current password is incorrect',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hashedPassword = await bcrypt.hash(
      changePasswordDto.new_password,
      10,
    );
    await this.userRepo.update(userId, { password: hashedPassword });
    return { message: 'Password updated successfully' };
  }

  async updateNotificationToken(
    userId: string,
    updateNotificationTokenDto: UpdateNotificationTokenDto,
  ) {
    const existing = await this.userRepo.findOne({ where: { id: userId } });
    if (!existing) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    await this.userRepo.update(userId, {
      notification_token: updateNotificationTokenDto.notification_token,
    });

    return { message: 'Notification token updated successfully' };
  }

  async sendTestNotification(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    if (!user.notification_token) {
      throw new HttpException(
        'This user has not registered a device for push notifications',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.notificationsService.sendToUser(
      user.id,
      'Test notification',
      `Hi ${user.full_name}, this is a test push notification.`,
    );

    return { message: 'Test notification sent successfully' };
  }

  private async ensureEmailNotTaken(email: string) {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new HttpException('Email already in use', HttpStatus.CONFLICT);
    }
  }

  private async ensureEmployeeCodeNotTaken(employeeCode: string) {
    const existing = await this.userRepo.findOne({
      where: { employee_code: employeeCode },
    });
    if (existing) {
      throw new HttpException(
        'Employee code already in use',
        HttpStatus.CONFLICT,
      );
    }
  }

  private sanitize(user: UserEntity) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }
}
