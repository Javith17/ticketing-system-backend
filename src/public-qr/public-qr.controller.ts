import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TICKET_IMAGE_MULTER_OPTIONS } from '../common/utils/ticket-image.util';
import { QrCodeLookupDto } from '../dto/master-details.dto';
import {
  CreatePublicUserDto,
  CreateTicketFromQrDto,
  GetPublicUserByEmailDto,
  GetTicketsByPublicUserDto,
  UpdatePublicUserDto,
} from '../dto/public-qr.dto';
import { PublicQrService } from './public-qr.service';

// No AuthGuard/AuthInterceptor on this controller - these endpoints are for
// unauthenticated public QR-code guest flows.
@Controller('public-qr')
export class PublicQrController {
  constructor(private readonly publicQrService: PublicQrService) {}

  @Post('qrcode')
  getQrCode(@Body() body: QrCodeLookupDto) {
    return this.publicQrService.getQrCode(body);
  }

  @Post('users')
  createPublicUser(@Body() createPublicUserDto: CreatePublicUserDto) {
    return this.publicQrService.createPublicUser(createPublicUserDto);
  }

  @Patch('users/:id')
  updatePublicUser(
    @Param('id') id: string,
    @Body() updatePublicUserDto: UpdatePublicUserDto,
  ) {
    return this.publicQrService.updatePublicUser(id, updatePublicUserDto);
  }

  @Get('users/by-email')
  getPublicUserByEmail(@Query() getByEmailDto: GetPublicUserByEmailDto) {
    return this.publicQrService.getPublicUserByEmail(getByEmailDto);
  }

  @Post('tickets')
  @UseInterceptors(FileInterceptor('image', TICKET_IMAGE_MULTER_OPTIONS))
  createTicket(
    @Body() createTicketDto: CreateTicketFromQrDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.publicQrService.createTicket(createTicketDto, image);
  }

  @Get('tickets')
  getTicketsByPublicUser(@Query() getTicketsDto: GetTicketsByPublicUserDto) {
    return this.publicQrService.getTicketsByPublicUser(getTicketsDto);
  }
}
