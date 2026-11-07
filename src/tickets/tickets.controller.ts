import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import { TICKET_IMAGE_MULTER_OPTIONS } from '../common/utils/ticket-image.util';
import {
  ApproveClosureDto,
  AssignRsmDto,
  AssignTechnicianDto,
  CreateTicketDto,
  StartWorkDto,
  TicketListDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from '../dto/ticket.dto';
import { TicketsService } from './tickets.service';

@UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', TICKET_IMAGE_MULTER_OPTIONS))
  create(
    @Body() createTicketDto: CreateTicketDto,
    @CurrentUser('userId') userId: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.ticketsService.create(createTicketDto, userId, image);
  }

  @Get()
  findAll(@Query() listDto: TicketListDto) {
    return this.ticketsService.findAll(listDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTicketStatusDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.updateStatus(id, updateStatusDto, userId);
  }

  @Post(':id/assign-rsm')
  assignRsm(
    @Param('id') id: string,
    @Body() assignRsmDto: AssignRsmDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.assignRsm(id, assignRsmDto, userId);
  }

  @Post(':id/assign-technician')
  assignTechnician(
    @Param('id') id: string,
    @Body() assignTechnicianDto: AssignTechnicianDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.assignTechnician(
      id,
      assignTechnicianDto,
      userId,
    );
  }

  @Post(':id/start')
  startWork(
    @Param('id') id: string,
    @Body() startWorkDto: StartWorkDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.startWork(id, startWorkDto, userId);
  }

  @Post(':id/findings')
  @UseInterceptors(
    FilesInterceptor('attachments', 3, TICKET_IMAGE_MULTER_OPTIONS),
  )
  addFindings(
    @Param('id') id: string,
    @Body() body: { remarks: string; test_values?: string },
    @CurrentUser('userId') userId: string,
    @UploadedFiles() attachments?: Express.Multer.File[],
  ) {
    return this.ticketsService.addFindings(id, body, attachments, userId);
  }

  @Post(':id/close')
  @UseInterceptors(
    FilesInterceptor('attachments', 3, TICKET_IMAGE_MULTER_OPTIONS),
  )
  closeTicket(
    @Param('id') id: string,
    @Body() body: { description?: string; remarks: string },
    @CurrentUser('userId') userId: string,
    @UploadedFiles() attachments?: Express.Multer.File[],
  ) {
    return this.ticketsService.closeTicket(id, body, attachments, userId);
  }

  @Post(':id/approve-closure')
  approveClosure(
    @Param('id') id: string,
    @Body() approveClosureDto: ApproveClosureDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ticketsService.approveClosure(id, approveClosureDto, userId);
  }

  @Get(':id/details')
  getDetails(@Param('id') id: string) {
    return this.ticketsService.getDetails(id);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.ticketsService.getHistory(id);
  }
}
