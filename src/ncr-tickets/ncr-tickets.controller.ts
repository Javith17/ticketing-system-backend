import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import { TICKET_IMAGE_MULTER_OPTIONS } from '../common/utils/ticket-image.util';
import {
  CreateNcrTicketDto,
  NcrApprovalActionDto,
  NcrClosureRemarksDto,
  NcrTicketListDto,
  QualityReviewDto,
} from '../dto/ncr-ticket.dto';
import { NcrTicketsService } from './ncr-tickets.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('ncr-tickets')
export class NcrTicketsController {
  constructor(private readonly ncrTicketsService: NcrTicketsService) {}

  // ADMIN (super admin) may raise an NCR from the web app on behalf of a
  // technician - see NcrTicketsService.create.
  @Post()
  @UseGuards(RolesGuard)
  @Roles('TECHNICIAN', 'ADMIN')
  create(
    @Body() dto: CreateNcrTicketDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.ncrTicketsService.create(dto, userId, roleCode);
  }

  @Get()
  findAll(@Query() listDto: NcrTicketListDto) {
    return this.ncrTicketsService.findAll(listDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ncrTicketsService.findOne(id);
  }

  // ADMIN (super admin) can also submit the quality review from the web.
  @Patch(':id/quality-review')
  @UseGuards(RolesGuard)
  @Roles('QUALITY', 'ADMIN')
  qualityReview(
    @Param('id') id: string,
    @Body() dto: QualityReviewDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrTicketsService.qualityReview(id, dto, userId);
  }

  // ADMIN (super admin) can also approve / reject from the web.
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('PM_DH', 'ADMIN')
  approve(
    @Param('id') id: string,
    @Body() dto: NcrApprovalActionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrTicketsService.approve(id, dto, userId);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('PM_DH', 'ADMIN')
  reject(
    @Param('id') id: string,
    @Body() dto: NcrApprovalActionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrTicketsService.reject(id, dto, userId);
  }

  @Patch(':id/technician-closure')
  @UseGuards(RolesGuard)
  @Roles('TECHNICIAN', 'ADMIN')
  @UseInterceptors(
    FilesInterceptor('attachments', 3, TICKET_IMAGE_MULTER_OPTIONS),
  )
  technicianClosure(
    @Param('id') id: string,
    @Body() body: { remarks: string },
    @CurrentUser('userId') userId: string,
    @UploadedFiles() attachments?: Express.Multer.File[],
  ) {
    return this.ncrTicketsService.technicianClosure(
      id,
      body,
      attachments,
      userId,
    );
  }

  @Patch(':id/pm-closure')
  @UseGuards(RolesGuard)
  @Roles('PM_DH')
  pmClosure(
    @Param('id') id: string,
    @Body() dto: NcrClosureRemarksDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrTicketsService.pmClosure(id, dto, userId);
  }

  @Patch(':id/quality-closure')
  @UseGuards(RolesGuard)
  @Roles('QUALITY')
  qualityClosure(
    @Param('id') id: string,
    @Body() dto: NcrClosureRemarksDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrTicketsService.qualityClosure(id, dto, userId);
  }
}
