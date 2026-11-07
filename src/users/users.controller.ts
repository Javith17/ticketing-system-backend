import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import { ChangePasswordDto } from '../dto/auth.dto';
import {
  CreateUserDto,
  UpdateNotificationTokenDto,
  UpdateUserDto,
  UserListDto,
} from '../dto/user.dto';
import { UsersService } from './users.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query() listDto: UserListDto) {
    return this.usersService.findAll(listDto);
  }

  @Patch('/change-password')
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Patch('/update-notification-token')
  updateNotificationToken(
    @Body() updateNotificationTokenDto: UpdateNotificationTokenDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.usersService.updateNotificationToken(
      userId,
      updateNotificationTokenDto,
    );
  }

  @Post(':id/send-test-notification')
  sendTestNotification(@Param('id') id: string) {
    return this.usersService.sendTestNotification(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
