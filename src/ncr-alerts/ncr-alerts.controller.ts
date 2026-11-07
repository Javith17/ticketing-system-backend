import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import { NcrAlertListDto, SaveNcrThresholdsDto } from '../dto/ncr-alert.dto';
import { NcrAlertsService } from './ncr-alerts.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller()
export class NcrAlertsController {
  constructor(private readonly ncrAlertsService: NcrAlertsService) {}

  @Get('ncr-thresholds')
  getThresholds() {
    return this.ncrAlertsService.getThresholds();
  }

  @Put('ncr-thresholds')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  saveThresholds(@Body() dto: SaveNcrThresholdsDto) {
    return this.ncrAlertsService.saveThresholds(dto);
  }

  @Get('ncr-alerts')
  findAlerts(@Query() listDto: NcrAlertListDto) {
    return this.ncrAlertsService.findAlerts(listDto);
  }

  @Get('ncr-alerts/unseen-count')
  getUnseenCount() {
    return this.ncrAlertsService.getUnseenCount();
  }

  @Patch('ncr-alerts/mark-seen')
  markSeen() {
    return this.ncrAlertsService.markSeen();
  }

  @Post('ncr-alerts/:id/raise-ncr')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  raiseNcr(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.ncrAlertsService.raiseNcrForAlert(id, userId);
  }
}
