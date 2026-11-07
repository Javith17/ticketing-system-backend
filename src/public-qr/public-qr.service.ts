import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { ExternalApiClientService } from '../common/http/external-api-client.service';
import { saveTicketImage } from '../common/utils/ticket-image.util';
import {
  CreatePublicUserDto,
  CreateTicketFromQrDto,
  GetPublicUserByEmailDto,
  GetTicketsByPublicUserDto,
  UpdatePublicUserDto,
} from '../dto/public-qr.dto';
import { QrCodeLookupDto } from '../dto/master-details.dto';
import { PublicUserEntity } from '../model/public_user.entity';
import { TicketEntity } from '../model/ticket.entity';
import { TicketHistoryService } from '../tickets/ticket-history.service';

@Injectable()
export class PublicQrService {
  constructor(
    @InjectRepository(PublicUserEntity)
    private publicUserRepo: Repository<PublicUserEntity>,
    @InjectRepository(TicketEntity)
    private ticketRepo: Repository<TicketEntity>,
    private ticketHistoryService: TicketHistoryService,
    private externalApiClient: ExternalApiClientService,
  ) {}

  // Unauthenticated qrcode -> pole lookup for the public scan-to-complaint
  // flow (tkt_qr_public_app has no login/token at all, so it can't use the
  // AuthGuard-protected /master-details/qrcode route meant for staff apps).
  async getQrCode(query: QrCodeLookupDto) {
    return this.externalApiClient.post('masterdetails/qrcode', {
      qrcode: query.qrcode,
    });
  }

  async createPublicUser(createPublicUserDto: CreatePublicUserDto) {
    const existing = await this.publicUserRepo.findOne({
      where: { email: createPublicUserDto.email_id },
    });
    if (existing) {
      throw new HttpException(
        'Public user with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    const publicUser = await this.publicUserRepo.save({
      guest_id: crypto.randomUUID(),
      email: createPublicUserDto.email_id,
      os_type: 'unknown',
    });

    return { message: 'Public user created successfully', data: publicUser };
  }

  async updatePublicUser(id: string, updatePublicUserDto: UpdatePublicUserDto) {
    const existing = await this.publicUserRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Public user not found', HttpStatus.NOT_FOUND);
    }

    if (
      updatePublicUserDto.email &&
      updatePublicUserDto.email !== existing.email
    ) {
      const emailTaken = await this.publicUserRepo.findOne({
        where: { email: updatePublicUserDto.email },
      });
      if (emailTaken) {
        throw new HttpException('Email already in use', HttpStatus.CONFLICT);
      }
    }

    await this.publicUserRepo.update(id, updatePublicUserDto);
    const updated = await this.publicUserRepo.findOne({ where: { id } });
    return { message: 'Public user updated successfully', data: updated };
  }

  async getPublicUserByEmail(getByEmailDto: GetPublicUserByEmailDto) {
    const publicUser = await this.publicUserRepo.findOne({
      where: { email: getByEmailDto.email },
    });
    if (!publicUser) {
      throw new HttpException('Public user not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Public user fetched successfully', data: publicUser };
  }

  async createTicket(
    createTicketDto: CreateTicketFromQrDto,
    image?: Express.Multer.File,
  ) {
    // Location/Section/Pole aren't local tables (they're proxied from the
    // external master-data API via /master-details/qrcode), so there's
    // nothing to validate against here - the scan flow only ever submits
    // ids/names from a real qrcode lookup result.
    let publicUser: PublicUserEntity;

    if (createTicketDto.public_user_id) {
      publicUser = await this.publicUserRepo.findOne({
        where: { id: createTicketDto.public_user_id },
      });
      if (!publicUser) {
        throw new HttpException('Public user not found', HttpStatus.NOT_FOUND);
      }
    } else {
      publicUser = await this.publicUserRepo.save({
        guest_id: this.generateGuestId(),
        email: createTicketDto.email,
        os_type: 'unknown',
      });
    }

    const ticketId = await this.generateTicketId();
    const imagePath = image
      ? saveTicketImage('public_complaints', ticketId, image)
      : undefined;

    const ticket = await this.ticketRepo.save({
      ticket_id: ticketId,
      issue: createTicketDto.issue,
      description: createTicketDto.description,
      pole_id: createTicketDto.pole_id,
      pole_name: createTicketDto.pole_name,
      location_name: createTicketDto.location_name,
      section_name: createTicketDto.section_name,
      location_id: createTicketDto.location_id,
      section_id: createTicketDto.section_id,
      latitude: createTicketDto.latitude,
      longitude: createTicketDto.longitude,
      asset_id: createTicketDto.asset_id,
      source: 'QR',
      public_user_id: publicUser.id,
      image_path: imagePath,
      status: 'Under Review',
    });

    this.ticketHistoryService.record(
      ticket.id,
      'created',
      undefined,
      'Ticket created',
    );

    return {
      message: 'Ticket created successfully',
      data: ticket,
      public_user_id: publicUser.id,
      guest_id: publicUser.guest_id,
    };
  }

  async getTicketsByPublicUser(getTicketsDto: GetTicketsByPublicUserDto) {
    const page = getTicketsDto.page || 1;
    const limit = getTicketsDto.limit || 20;

    const [data, total] = await this.ticketRepo.findAndCount({
      where: { public_user_id: getTicketsDto.public_user_id },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      message: 'Tickets fetched successfully',
      data,
      total,
      page,
      limit,
    };
  }

  private generateGuestId(): string {
    const randomThreeDigits = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `Guest_${randomThreeDigits}`;
  }

  private async generateTicketId(): Promise<string> {
    const count = await this.ticketRepo.count();
    return `TCK-${String(count + 1).padStart(6, '0')}`;
  }
}
