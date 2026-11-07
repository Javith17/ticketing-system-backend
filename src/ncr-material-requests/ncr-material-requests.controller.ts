import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  ApproveNcrMaterialRequestDto,
  CreateNcrMaterialRequestDto,
  IssueNcrMaterialDto,
  ReceiveNcrMaterialDto,
  RecordDispositionDto,
} from '../dto/ncr-material-request.dto';
import { NcrMaterialRequestsService } from './ncr-material-requests.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('ncr-material-requests')
export class NcrMaterialRequestsController {
  constructor(
    private readonly ncrMaterialRequestsService: NcrMaterialRequestsService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TECHNICIAN', 'ADMIN')
  create(@Body() dto: CreateNcrMaterialRequestDto) {
    return this.ncrMaterialRequestsService.create(dto);
  }

  @Get('by-ncr/:ncrTicketId')
  findByNcrTicket(@Param('ncrTicketId') ncrTicketId: string) {
    return this.ncrMaterialRequestsService.findByNcrTicket(ncrTicketId);
  }

  // ADMIN (super admin) can also approve material requests from the web.
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('PROD_HEAD', 'ADMIN')
  approve(@Param('id') id: string, @Body() dto: ApproveNcrMaterialRequestDto) {
    return this.ncrMaterialRequestsService.approve(id, dto);
  }

  // Process flow #40 - Stores issues the approved material.
  @Patch(':id/issue')
  @UseGuards(RolesGuard)
  @Roles('STORES', 'ADMIN')
  issue(
    @Param('id') id: string,
    @Body() dto: IssueNcrMaterialDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrMaterialRequestsService.issue(id, dto, userId);
  }

  // Process flow #42 - technician confirms receipt.
  @Patch(':id/receive')
  @UseGuards(RolesGuard)
  @Roles('TECHNICIAN', 'ADMIN')
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveNcrMaterialDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.ncrMaterialRequestsService.receive(id, dto, userId, roleCode);
  }

  // Process flow #43 - technician returns failed item(s). Multipart: 'items'
  // (JSON array) + up to 3 photos under 'attachments'.
  @Post(':id/returns')
  @UseGuards(RolesGuard)
  @Roles('TECHNICIAN', 'ADMIN')
  @UseInterceptors(
    FilesInterceptor('attachments', 3, TICKET_IMAGE_MULTER_OPTIONS),
  )
  returnItems(
    @Param('id') id: string,
    @Body() body: { items: unknown },
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
    @UploadedFiles() attachments?: Express.Multer.File[],
  ) {
    return this.ncrMaterialRequestsService.returnItems(
      id,
      body?.items,
      attachments,
      userId,
      roleCode,
    );
  }

  // Process flow #44 - Stores records the disposition of returned items.
  @Patch(':id/returns/disposition')
  @UseGuards(RolesGuard)
  @Roles('STORES', 'ADMIN')
  recordDisposition(
    @Param('id') id: string,
    @Body() dto: RecordDispositionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ncrMaterialRequestsService.recordDisposition(id, dto, userId);
  }
}
