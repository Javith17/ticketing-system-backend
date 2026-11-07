import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import {
  AlertBreachHistoryDto,
  DateRangeDto,
  HotspotReportDto,
  NcrHotspotReportDto,
  OverdueReportDto,
  ResolutionWorkloadReportDto,
} from '../dto/reports.dto';
import { ReportsService } from './reports.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tickets/overview')
  ticketsOverview(@Query() dto: DateRangeDto) {
    return this.reportsService.ticketsOverview(dto);
  }

  @Get('tickets/hotspot')
  ticketsHotspot(@Query() dto: HotspotReportDto) {
    return this.reportsService.ticketsHotspot(dto);
  }

  @Get('tickets/overdue')
  ticketsOverdue(@Query() dto: OverdueReportDto) {
    return this.reportsService.ticketsOverdue(dto);
  }

  @Get('tickets/resolution-workload')
  resolutionWorkload(@Query() dto: ResolutionWorkloadReportDto) {
    return this.reportsService.resolutionWorkload(dto);
  }

  @Get('timeline')
  timeline(@Query('code') code: string) {
    return this.reportsService.timeline(code);
  }

  @Get('ncr/funnel')
  ncrFunnel(@Query() dto: DateRangeDto) {
    return this.reportsService.ncrFunnel(dto);
  }

  @Get('ncr/aging')
  ncrAging(@Query() dto: DateRangeDto) {
    return this.reportsService.ncrAging(dto);
  }

  @Get('ncr/hotspot')
  ncrHotspot(@Query() dto: NcrHotspotReportDto) {
    return this.reportsService.ncrHotspot(dto);
  }

  @Get('alerts/breach-history')
  alertBreachHistory(@Query() dto: AlertBreachHistoryDto) {
    return this.reportsService.alertBreachHistory(dto);
  }

  @Get('alerts/time-to-ncr')
  timeToNcr(@Query() dto: DateRangeDto) {
    return this.reportsService.timeToNcr(dto);
  }
}
