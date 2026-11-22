import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

//Base Controller for the application, providing a health check endpoint.
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): { message: string } {
    return this.appService.getHealth();
  }
}
