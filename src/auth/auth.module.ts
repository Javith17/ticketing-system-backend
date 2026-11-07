import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from '../model/role.entity';
import { UserEntity } from '../model/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guard/auth.guard';
import { RolesGuard } from './guard/roles.guard';
import { AuthInterceptor } from './middleware/interceptor.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RoleEntity])],
  providers: [AuthService, AuthGuard, AuthInterceptor, RolesGuard],
  controllers: [AuthController],
  exports: [AuthGuard, AuthInterceptor, RolesGuard],
})
export class AuthModule {}
