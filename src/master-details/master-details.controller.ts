import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import {
  LocationsListQueryDto,
  PolesListQueryDto,
  QrCodeLookupDto,
  SectionsListQueryDto,
} from '../dto/master-details.dto';
import { MasterDetailsService } from './master-details.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('master-details')
export class MasterDetailsController {
  constructor(private readonly masterDetailsService: MasterDetailsService) {}

  @Post('locations')
  getLocations(@Body() body: LocationsListQueryDto) {
    return this.masterDetailsService.getLocations(body);
  }

  @Post('sections')
  getSections(@Body() body: SectionsListQueryDto) {
    return this.masterDetailsService.getSections(body);
  }

  @Post('poles')
  getPoles(@Body() body: PolesListQueryDto) {
    return this.masterDetailsService.getPoles(body);
  }

  @Post('qrcode')
  getQrCode(@Body() body: QrCodeLookupDto) {
    return this.masterDetailsService.getQrCode(body);
  }
}
