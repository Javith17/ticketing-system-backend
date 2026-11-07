import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { saveTicketImage } from '../common/utils/ticket-image.util';
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
import { AssetEntity } from '../model/asset.entity';
import { PublicUserEntity } from '../model/public_user.entity';
import { TicketEntity } from '../model/ticket.entity';
import { TicketDetailsEntity } from '../model/ticket_details.entity';
import { TicketHistoryEntity } from '../model/ticket_history.entity';
import { UserEntity } from '../model/user.entity';
import { NcrAlertsService } from '../ncr-alerts/ncr-alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketHistoryService } from './ticket-history.service';

// The generic status endpoint only handles the Reviewed, Return, and Accept
// actions - dedicated transitions (Open -> Assigned RSM, Assigned RSM ->
// Assigned Technician, and the Started/Closed/Ticket Closed steps below) go
// through their own dedicated methods, which enforce their own from-status.
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  'Under Review': ['Open'],
  Open: ['Under Review'],
  'Assigned Technician': ['In Progress'],
};

const PM_DH_ROLE_CODE = 'PM_DH';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(TicketEntity)
    private ticketRepo: Repository<TicketEntity>,
    @InjectRepository(AssetEntity)
    private assetRepo: Repository<AssetEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(TicketHistoryEntity)
    private ticketHistoryRepo: Repository<TicketHistoryEntity>,
    @InjectRepository(TicketDetailsEntity)
    private ticketDetailsRepo: Repository<TicketDetailsEntity>,
    private ticketHistoryService: TicketHistoryService,
    private notificationsService: NotificationsService,
    private ncrAlertsService: NcrAlertsService,
  ) {}

  async create(
    createTicketDto: CreateTicketDto,
    userId?: string,
    image?: Express.Multer.File,
  ) {
    // Location/Section/Pole aren't local tables (they're proxied from the
    // external master-data API), so there's nothing to validate against
    // here - the picker UI only ever submits ids/names from a real search
    // result, and the barcode-scan shortcut only ever resolves a real pole.
    const ticketId = await this.generateTicketId();
    const imagePath = image
      ? saveTicketImage('mobile_app', ticketId, image)
      : undefined;

    const ticket = await this.ticketRepo.save({
      ...createTicketDto,
      ticket_id: ticketId,
      user_id: userId,
      image_path: imagePath,
    });

    this.ticketHistoryService.record(
      ticket.id,
      'created',
      userId,
      'Ticket created',
    );

    this.ncrAlertsService.checkAndLogBreaches(ticket);

    return { message: 'Ticket created successfully', data: ticket };
  }

  async update(id: string, updateTicketDto: UpdateTicketDto) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }

    await this.ticketRepo.update(id, updateTicketDto);
    const updated = await this.ticketRepo.findOne({ where: { id } });
    return { message: 'Ticket updated successfully', data: updated };
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateTicketStatusDto,
    userId?: string,
  ) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }

    const { status: requestedStatus, remarks } = updateStatusDto;
    const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[existing.status];
    if (
      !allowedNextStatuses ||
      !allowedNextStatuses.includes(requestedStatus)
    ) {
      throw new HttpException(
        `Cannot change status from '${existing.status}' to '${requestedStatus}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatePayload: Partial<TicketEntity> = { status: requestedStatus };
    let historyDetail = `Status changed from ${existing.status} to ${requestedStatus}`;

    if (requestedStatus === 'Under Review') {
      if (!remarks) {
        throw new HttpException(
          'Remarks are required when returning a ticket to Under Review',
          HttpStatus.BAD_REQUEST,
        );
      }
      const returnEntry = {
        return_by: userId,
        remarks,
        returned_at: new Date().toISOString(),
      };
      updatePayload.return_remarks = [
        ...(existing.return_remarks || []),
        returnEntry,
      ];
      historyDetail = `Returned to Under Review: ${remarks}`;
    }

    await this.ticketRepo.update(id, updatePayload);
    this.ticketHistoryService.record(
      id,
      'status_update',
      userId,
      historyDetail,
    );

    if (requestedStatus === 'Open') {
      this.notificationsService.sendToRoleCode(
        PM_DH_ROLE_CODE,
        'Ticket moved to Open',
        `Ticket ${existing.ticket_id} (${existing.issue}) is now Open.`,
        { ticket_id: id },
      );
    }

    const updated = await this.ticketRepo.findOne({ where: { id } });
    return { message: 'Ticket status updated successfully', data: updated };
  }

  async assignRsm(id: string, dto: AssignRsmDto, userId?: string) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'Open') {
      throw new HttpException(
        `Cannot assign RSM while ticket status is '${existing.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const rsmUser = await this.userRepo.findOne({
      where: { id: dto.assigned_rsm },
    });
    if (!rsmUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    await this.ticketRepo.update(id, {
      status: 'Assigned RSM',
      assigned_rsm: dto.assigned_rsm,
      rsm_assigned: {
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      },
    });
    this.ticketHistoryService.record(
      id,
      'status_update',
      userId,
      `Status changed from Open to Assigned RSM (assigned to ${rsmUser.full_name})`,
    );
    this.notificationsService.sendToUser(
      rsmUser.id,
      'Ticket assigned to you',
      `Ticket ${existing.ticket_id} (${existing.issue}) has been assigned to you as RSM.`,
      { ticket_id: id },
    );

    const updated = await this.ticketRepo.findOne({ where: { id } });
    return { message: 'Ticket assigned to RSM successfully', data: updated };
  }

  async assignTechnician(
    id: string,
    dto: AssignTechnicianDto,
    userId?: string,
  ) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'Assigned RSM') {
      throw new HttpException(
        `Cannot assign technician while ticket status is '${existing.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const technicianUser = await this.userRepo.findOne({
      where: { id: dto.assigned_to },
    });
    if (!technicianUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    await this.ticketRepo.update(id, {
      status: 'Assigned Technician',
      assigned_to: dto.assigned_to,
      technician_assigned: {
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      },
    });
    this.ticketHistoryService.record(
      id,
      'status_update',
      userId,
      `Status changed from Assigned RSM to Assigned Technician (assigned to ${technicianUser.full_name})`,
    );
    this.notificationsService.sendToUser(
      technicianUser.id,
      'Ticket assigned to you',
      `Ticket ${existing.ticket_id} (${existing.issue}) has been assigned to you as technician.`,
      { ticket_id: id },
    );

    const updated = await this.ticketRepo.findOne({ where: { id } });
    return {
      message: 'Ticket assigned to technician successfully',
      data: updated,
    };
  }

  async startWork(id: string, dto: StartWorkDto, userId?: string) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'In Progress') {
      throw new HttpException(
        `Cannot start work while ticket status is '${existing.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.ticketRepo.update(id, { status: 'Started' });
    await this.ticketDetailsRepo.save({
      ticket_id: id,
      event: 'Started',
      event_by: userId,
      remarks: dto.remarks,
    });
    this.ticketHistoryService.record(
      id,
      'status_update',
      userId,
      'Status changed from In Progress to Started',
    );

    const updated = await this.ticketRepo.findOne({ where: { id } });
    return { message: 'Work started successfully', data: updated };
  }

  async addFindings(
    id: string,
    body: { remarks: string; test_values?: string },
    attachments: Express.Multer.File[] | undefined,
    userId?: string,
  ) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'Started') {
      throw new HttpException(
        `Cannot add findings while ticket status is '${existing.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!body.remarks) {
      throw new HttpException('Remarks are required', HttpStatus.BAD_REQUEST);
    }

    const attachmentPaths = (attachments || []).map((file) =>
      saveTicketImage('ticket_details', id, file),
    );

    const detail = await this.ticketDetailsRepo.save({
      ticket_id: id,
      event: 'Add Findings',
      event_by: userId,
      remarks: body.remarks,
      test_values: body.test_values,
      attachments: attachmentPaths,
    });

    // Add Findings is a log-only event - tickets.status is intentionally
    // untouched and no ticket_history row is written.
    return { message: 'Findings added successfully', data: detail };
  }

  async closeTicket(
    id: string,
    body: { description?: string; remarks: string },
    attachments: Express.Multer.File[] | undefined,
    userId?: string,
  ) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'Started') {
      throw new HttpException(
        `Cannot close ticket while ticket status is '${existing.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!body.remarks) {
      throw new HttpException('Remarks are required', HttpStatus.BAD_REQUEST);
    }

    const attachmentPaths = (attachments || []).map((file) =>
      saveTicketImage('ticket_details', id, file),
    );
    const remarks = body.description
      ? `${body.description}\n\n${body.remarks}`
      : body.remarks;

    await this.ticketRepo.update(id, { status: 'Closure Approval' });
    await this.ticketDetailsRepo.save({
      ticket_id: id,
      event: 'Closed',
      event_by: userId,
      remarks,
      attachments: attachmentPaths,
    });
    this.ticketHistoryService.record(
      id,
      'status_update',
      userId,
      'Status changed from Started to Closure Approval',
    );
    this.notificationsService.sendToRoleCode(
      PM_DH_ROLE_CODE,
      'Ticket awaiting closure approval',
      `Ticket ${existing.ticket_id} (${existing.issue}) is ready for closure approval.`,
      { ticket_id: id },
    );

    const updated = await this.ticketRepo.findOne({ where: { id } });
    return { message: 'Ticket closed successfully', data: updated };
  }

  async approveClosure(id: string, dto: ApproveClosureDto, userId?: string) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (existing.status !== 'Closure Approval') {
      throw new HttpException(
        `Cannot approve closure while ticket status is '${existing.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.ticketRepo.update(id, { status: 'Ticket Closed' });
    await this.ticketDetailsRepo.save({
      ticket_id: id,
      event: 'Ticket Closed',
      event_by: userId,
      remarks: dto.remarks,
    });
    this.ticketHistoryService.record(
      id,
      'status_update',
      userId,
      'Status changed from Closure Approval to Ticket Closed',
    );

    const updated = await this.ticketRepo.findOne({ where: { id } });
    return { message: 'Ticket closure approved successfully', data: updated };
  }

  async getDetails(id: string) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }

    const data = await this.ticketDetailsRepo
      .createQueryBuilder('details')
      .leftJoin(UserEntity, 'user', 'user.id = details.event_by')
      .where('details.ticket_id = :id', { id })
      .orderBy('details.event_at', 'ASC')
      .select([
        'details.id AS id',
        'details.event AS event',
        'details.event_by AS event_by',
        'user.full_name AS event_by_name',
        'details.event_at AS event_at',
        'details.remarks AS remarks',
        'details.test_values AS test_values',
        'details.attachments AS attachments',
      ])
      .getRawMany();

    return { message: 'Ticket details fetched successfully', data };
  }

  async getHistory(id: string) {
    const existing = await this.ticketRepo.findOne({ where: { id } });
    if (!existing) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }

    const data = await this.ticketHistoryRepo
      .createQueryBuilder('history')
      .leftJoin(UserEntity, 'user', 'user.id = history.event_user')
      .where('history.ticket_id = :id', { id })
      .orderBy('history.event_at', 'ASC')
      .select([
        'history.id AS id',
        'history.event_at AS event_at',
        'history.event_type AS event_type',
        'history.event_user AS event_user',
        'user.full_name AS event_user_name',
        'history.event_detail AS event_detail',
      ])
      .getRawMany();

    return { message: 'Ticket history fetched successfully', data };
  }

  async findAll(listDto: TicketListDto) {
    const page = listDto.page || 1;
    const limit = listDto.limit || 20;

    // The asset join is kept only to enrich pre-migration tickets (which
    // still carry asset_id) with asset_name for backward display - new
    // tickets are self-sufficient via the denormalized location/section/pole
    // columns below and don't need a join.
    const query = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin(AssetEntity, 'asset', 'asset.id = ticket.asset_id')
      .leftJoin(
        PublicUserEntity,
        'publicUser',
        'publicUser.id = ticket.public_user_id',
      )
      .leftJoin(UserEntity, 'ticketUser', 'ticketUser.id = ticket.user_id')
      .where('ticket.is_active = :isActive', { isActive: true })
      .orderBy('ticket.created_at', 'DESC');

    if (listDto.search) {
      query.andWhere(
        '(LOWER(ticket.issue) LIKE :search OR LOWER(ticket.description) LIKE :search OR LOWER(ticket.ticket_id) LIKE :search)',
        { search: `%${listDto.search.toLowerCase()}%` },
      );
    }

    if (listDto.asset_id) {
      query.andWhere('ticket.asset_id = :assetId', {
        assetId: listDto.asset_id,
      });
    }

    if (listDto.status) {
      query.andWhere('ticket.status = :status', { status: listDto.status });
    }

    if (listDto.source) {
      query.andWhere('ticket.source = :source', { source: listDto.source });
    }

    if (listDto.assigned_to) {
      query.andWhere('ticket.assigned_to = :assignedTo', {
        assignedTo: listDto.assigned_to,
      });
    }

    if (listDto.location) {
      query.andWhere('asset.location = :location', {
        location: listDto.location,
      });
    }

    if (listDto.location_id) {
      query.andWhere('ticket.location_id = :locationId', {
        locationId: listDto.location_id,
      });
    }

    if (listDto.section_id) {
      query.andWhere('ticket.section_id = :sectionId', {
        sectionId: listDto.section_id,
      });
    }

    if (listDto.pole_id) {
      query.andWhere('ticket.pole_id = :poleId', {
        poleId: listDto.pole_id,
      });
    }

    if (listDto.created_from) {
      query.andWhere('ticket.created_at >= :createdFrom', {
        createdFrom: listDto.created_from,
      });
    }

    if (listDto.created_to) {
      query.andWhere('ticket.created_at <= :createdTo', {
        createdTo: listDto.created_to,
      });
    }

    const total = await query.getCount();

    const rawData = await query
      .select([
        'ticket.id AS id',
        'ticket.ticket_id AS ticket_id',
        'ticket.issue AS issue',
        'ticket.description AS description',
        'ticket.asset_id AS asset_id',
        'asset.asset_name AS asset_name',
        'ticket.location_id AS location_id',
        'ticket.location_name AS location_name',
        'ticket.section_id AS section_id',
        'ticket.section_name AS section_name',
        'ticket.pole_id AS pole_id',
        'ticket.pole_name AS pole_name',
        'ticket.latitude AS latitude',
        'ticket.longitude AS longitude',
        'ticket.source AS source',
        'ticket.user_id AS user_id',
        'ticketUser.full_name AS user_name',
        'ticket.public_user_id AS public_user_id',
        'publicUser.first_name AS public_user_first_name',
        'publicUser.last_name AS public_user_last_name',
        'ticket.status AS status',
        'ticket.priority AS priority',
        'ticket.assigned_to AS assigned_to',
        'ticket.assigned_rsm AS assigned_rsm',
        'ticket.rsm_assigned AS rsm_assigned',
        'ticket.technician_assigned AS technician_assigned',
        'ticket.return_remarks AS return_remarks',
        'ticket.due_at AS due_at',
        'ticket.resolved_at AS resolved_at',
        'ticket.is_active AS is_active',
        'ticket.created_at AS created_at',
        'ticket.updated_at AS updated_at',
      ])
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return {
      message: 'Tickets fetched successfully',
      data: rawData,
      total,
      page,
      limit,
    };
  }

  private async generateTicketId(): Promise<string> {
    const count = await this.ticketRepo.count();
    return `TCK-${String(count + 1).padStart(6, '0')}`;
  }
}
