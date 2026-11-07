import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { ForgotPasswordDto, SignInDto } from '../dto/auth.dto';
import { RoleEntity } from '../model/role.entity';
import { UserEntity } from '../model/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private roleRepo: Repository<RoleEntity>,
    private configService: ConfigService,
  ) {}

  async signIn(signInDto: SignInDto) {
    const user = await this.userRepo.findOne({
      where: { email: signInDto.email, is_active: true },
    });

    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    const passwordMatches = await bcrypt.compare(
      signInDto.password,
      user.password,
    );
    if (!passwordMatches) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    const role = await this.roleRepo.findOne({ where: { id: user.role_id } });

    const payload = {
      userId: user.id,
      roleId: user.role_id,
      roleName: role?.role_name,
      roleCode: role?.role_code,
      email: user.email,
    };

    const secret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '1d';
    const accessToken = jwt.sign(payload, secret, {
      expiresIn,
    } as jwt.SignOptions);

    return {
      message: 'Success',
      accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        employee_code: user.employee_code,
        first_name: user.first_name,
        last_name: user.last_name,
        designation: user.designation,
        phone: user.phone,
        role_id: user.role_id,
        role_name: role?.role_name,
        role_code: role?.role_code,
        features: role?.features || [],
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({
      where: { email: forgotPasswordDto.email, is_active: true },
    });

    // Reset silently when found so the response can't be used to enumerate accounts.
    if (user?.employee_code) {
      const hashedPassword = await bcrypt.hash(user.employee_code, 10);
      await this.userRepo.update(user.id, { password: hashedPassword });
    }

    return {
      message:
        'If the email is registered, the password has been reset to the default (employee code).',
    };
  }
}
