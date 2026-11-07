import { Body, Controller, Get, Post } from '@nestjs/common';
import { ForgotPasswordDto, SignInDto } from '../dto/auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('/healthCheck')
  healthCheck(): { message: string } {
    return { message: 'Connected' };
  }

  @Post('/signIn')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Post('/forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }
}
