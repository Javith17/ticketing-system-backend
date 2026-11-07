import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { message: string } {
    return { message: 'Ticketing System API is running' };
  }
}
