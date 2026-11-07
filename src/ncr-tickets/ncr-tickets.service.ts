import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { saveTicketImage } from '../common/utils/ticket-image.util';
import {
  CreateNcrTicketDto,
  NcrApprovalActionDto,
  NcrClosureRemarksDto,
  NcrTicketListDto,
  QualityReviewDto,
} from '../dto/ncr-ticket.dto';
import { NcrTicketEntity } from '../model/ncr-ticket.entity';
import { RoleEntity } from '../model/role.entity';
import { TicketEntity } from '../model/ticket.entity';
import { UserEntity } from '../model/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

const TECHNICIAN_ROLE_CODE = 'TECHNICIAN';
const PM_DH_ROLE_CODE = 'PM_DH';
const PROD_HEAD_ROLE_CODE = 'PROD_HEAD';
const QUALITY_ROLE_CODE = 'QUALITY';
const ADMIN_ROLE_CODE = 'ADMIN';

@Injectable()
export class NcrTicketsService {
  constructor(
    @InjectRepository(NcrTicketEntity)
    private ncrTicketRepo: Repository<NcrTicketEntity>,
    @InjectRepository(TicketEntity)
    private ticketRepo: Repository<TicketEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private roleRepo: Repository<RoleEntity>,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateNcrTicketDto, userId?: string, roleCode?: string) {
    // A technician always raises as themselves. A super admin raises on
    // behalf of a technician picked in the web app: that technician becomes
    // raised_by (so it shows in their NCR list and they get its
    // notifications) and the admin is kept in created_by.
    const isAdmin = roleCode === ADMIN_ROLE_CODE;
    let raisedBy = userId;
    if (isAdmin) {
      if (!dto.raised_by) {
        throw new HttpException(
          'Select the technician this NCR is raised on behalf of',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.ensureActiveTechnician(dto.raised_by);
      raisedBy = dto.raised_by;
    }

    const ticket = await this.ticketRepo.findOne({
      where: { id: dto.ticket_id },
    });
    if (!ticket) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }

    const ncrTicketId = await this.generateTicketId();
    const saved = await this.ncrTicketRepo.save({
      ticket_id: ncrTicketId,
      linked_tickets: [{ ticket_id: ticket.id, ticket_no: ticket.ticket_id }],
      description: dto.description,
      status: 'In-Review',
      raised_by: raisedBy,
      created_by: userId,
    });

    this.notificationsService.sendToRoleCode(
      QUALITY_ROLE_CODE,
      'NCR raised for review',
      `NCR ${ncrTicketId} (against ticket ${ticket.ticket_id}) is awaiting quality review.`,
      { ncr_ticket_id: saved.id },
    );
    this.notificationsService.sendToRoleCode(
      PM_DH_ROLE_CODE,
      'NCR raised for approval',
      `NCR ${ncrTicketId} (against ticket ${ticket.ticket_id}) has been raised and will need your approval.`,
      { ncr_ticket_id: saved.id },
    );
    this.notificationsService.sendToRoleCode(
      PROD_HEAD_ROLE_CODE,
      'NCR raised',
      `NCR ${ncrTicketId} (against ticket ${ticket.ticket_id}) has been raised for awareness.`,
      { ncr_ticket_id: saved.id },
    );
    if (isAdmin) {
      this.notificationsService.sendToUser(
        raisedBy,
        'NCR raised on your behalf',
        `NCR ${ncrTicketId} (against ticket ${ticket.ticket_id}) has been raised on your behalf.`,
        { ncr_ticket_id: saved.id },
      );
    }

    return {
      message: 'NCR ticket created successfully',
      data: await this.findOneWithNames(saved.id),
    };
  }

  // Raises one NCR linking multiple regular tickets at once - used by
  // NcrAlertsService.raiseNcrForAlert, where the "tickets" are whichever
  // ones breached a Location/Section/Pole threshold together. Unlike
  // create(), there's no single reporting technician, so raised_by and
  // created_by are both set to the acting (admin) user.
  async createFromTickets(ticketIds: string[], description: string, userId: string) {
    const tickets = await this.ticketRepo.find({ where: { id: In(ticketIds) } });
    if (tickets.length === 0) {
      throw new HttpException('No tickets found', HttpStatus.NOT_FOUND);
    }

    const ncrTicketId = await this.generateTicketId();
    const saved = await this.ncrTicketRepo.save({
      ticket_id: ncrTicketId,
      linked_tickets: tickets.map((t) => ({ ticket_id: t.id, ticket_no: t.ticket_id })),
      description,
      status: 'In-Review',
      raised_by: userId,
      created_by: userId,
    });

    const ticketLabel = tickets.map((t) => t.ticket_id).join(', ');
    this.notificationsService.sendToRoleCode(
      QUALITY_ROLE_CODE,
      'NCR raised for review',
      `NCR ${ncrTicketId} (against tickets ${ticketLabel}) is awaiting quality review.`,
      { ncr_ticket_id: saved.id },
    );
    this.notificationsService.sendToRoleCode(
      PM_DH_ROLE_CODE,
      'NCR raised for approval',
      `NCR ${ncrTicketId} (against tickets ${ticketLabel}) has been raised and will need your approval.`,
      { ncr_ticket_id: saved.id },
    );
    this.notificationsService.sendToRoleCode(
      PROD_HEAD_ROLE_CODE,
      'NCR raised',
      `NCR ${ncrTicketId} (against tickets ${ticketLabel}) has been raised for awareness.`,
      { ncr_ticket_id: saved.id },
    );

    return {
      message: 'NCR ticket created successfully',
      data: await this.findOneWithNames(saved.id),
    };
  }

  async findAll(listDto: NcrTicketListDto) {
    const page = listDto.page || 1;
    const limit = listDto.limit || 20;

    const query = this.ncrTicketRepo
      .createQueryBuilder('ncr')
      .where('ncr.is_active = :isActive', { isActive: true })
      .orderBy('ncr.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (listDto.status) {
      query.andWhere('ncr.status = :status', { status: listDto.status });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      message: 'NCR tickets fetched successfully',
      data: await this.attachUserNames(data),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const ncr = await this.findOneWithNames(id);
    return { message: 'NCR ticket fetched successfully', data: ncr };
  }

  async qualityReview(id: string, dto: QualityReviewDto, userId?: string) {
    const ncr = await this.findOrFail(id);
    if (ncr.status !== 'In-Review') {
      throw new HttpException(
        `Cannot submit quality review while NCR status is '${ncr.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const entry = {
      review_type: 'quality_review',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_remarks: dto.review_remarks,
    };
    await this.ncrTicketRepo.update(id, {
      review_detail: [...(ncr.review_detail || []), entry],
    });

    const updated = await this.findOneWithNames(id);
    return { message: 'Quality review submitted successfully', data: updated };
  }

  async approve(id: string, dto: NcrApprovalActionDto, userId?: string) {
    return this.applyApprovalDecision(
      id,
      dto,
      userId,
      'PM Approval',
      'Approved',
    );
  }

  async reject(id: string, dto: NcrApprovalActionDto, userId?: string) {
    return this.applyApprovalDecision(
      id,
      dto,
      userId,
      'PM Rejection',
      'Rejected',
    );
  }

  async technicianClosure(
    id: string,
    body: { remarks: string },
    attachments: Express.Multer.File[] | undefined,
    userId?: string,
  ) {
    const ncr = await this.findOrFail(id);
    // Closure follows the Stores cycle: straight after receipt when no failed
    // item is being returned, or once Stores has dispositioned the returned
    // item(s).
    if (
      ncr.status !== 'Material_received' &&
      ncr.status !== 'Return_dispositioned'
    ) {
      throw new HttpException(
        `Cannot close NCR while status is '${ncr.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!body.remarks) {
      throw new HttpException('Remarks are required', HttpStatus.BAD_REQUEST);
    }

    const attachmentPaths = (attachments || []).map((file) =>
      saveTicketImage('ncr-closures', id, file),
    );

    const entry = {
      closure_type: 'technician_closure',
      closure_remarks: body.remarks,
      closure_by: userId,
      closure_at: new Date().toISOString(),
      closure_attachments: attachmentPaths,
    };
    await this.ncrTicketRepo.update(id, {
      status: 'Technician Closed',
      closure_details: [...(ncr.closure_details || []), entry],
    });

    this.notificationsService.sendToRoleCode(
      PM_DH_ROLE_CODE,
      'NCR awaiting closure approval',
      `NCR ${ncr.ticket_id} has been closed by the technician and is awaiting your closure.`,
      { ncr_ticket_id: id },
    );

    const updated = await this.findOneWithNames(id);
    return { message: 'NCR closed by technician successfully', data: updated };
  }

  async pmClosure(id: string, dto: NcrClosureRemarksDto, userId?: string) {
    const ncr = await this.findOrFail(id);
    if (ncr.status !== 'Technician Closed') {
      throw new HttpException(
        `Cannot close NCR while status is '${ncr.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const entry = {
      closure_type: 'pm_closure',
      closure_remarks: dto.closure_remarks,
      closure_by: userId,
      closure_at: new Date().toISOString(),
    };
    await this.ncrTicketRepo.update(id, {
      status: 'PM Closed',
      closure_details: [...(ncr.closure_details || []), entry],
    });

    this.notificationsService.sendToRoleCode(
      QUALITY_ROLE_CODE,
      'NCR awaiting quality closure',
      `NCR ${ncr.ticket_id} has been closed by PM_DH and is awaiting quality closure.`,
      { ncr_ticket_id: id },
    );

    const updated = await this.findOneWithNames(id);
    return { message: 'NCR closed by PM_DH successfully', data: updated };
  }

  async qualityClosure(id: string, dto: NcrClosureRemarksDto, userId?: string) {
    const ncr = await this.findOrFail(id);
    if (ncr.status !== 'PM Closed') {
      throw new HttpException(
        `Cannot close NCR while status is '${ncr.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const entry = {
      closure_type: 'quality_closed',
      closure_remarks: dto.closure_remarks,
      closure_by: userId,
      closure_at: new Date().toISOString(),
    };
    await this.ncrTicketRepo.update(id, {
      status: 'Closed',
      closure_details: [...(ncr.closure_details || []), entry],
    });

    const updated = await this.findOneWithNames(id);
    return { message: 'NCR closed successfully', data: updated };
  }

  private async applyApprovalDecision(
    id: string,
    dto: NcrApprovalActionDto,
    userId: string | undefined,
    approvalType: 'PM Approval' | 'PM Rejection',
    nextStatus: 'Approved' | 'Rejected',
  ) {
    const ncr = await this.findOrFail(id);
    if (ncr.status !== 'In-Review') {
      throw new HttpException(
        `Cannot ${nextStatus === 'Approved' ? 'approve' : 'reject'} NCR while status is '${ncr.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const entry = {
      approval_type: approvalType,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      approval_remarks: dto.approval_remarks,
    };
    await this.ncrTicketRepo.update(id, {
      status: nextStatus,
      approval_details: [...(ncr.approval_details || []), entry],
    });

    const updated = await this.findOneWithNames(id);
    return {
      message: `NCR ${nextStatus === 'Approved' ? 'approved' : 'rejected'} successfully`,
      data: updated,
    };
  }

  private async findOrFail(id: string): Promise<NcrTicketEntity> {
    const ncr = await this.ncrTicketRepo.findOne({ where: { id } });
    if (!ncr) {
      throw new HttpException('NCR ticket not found', HttpStatus.NOT_FOUND);
    }
    return ncr;
  }

  private async ensureActiveTechnician(userId: string) {
    const technicianRole = await this.roleRepo.findOne({
      where: { role_code: TECHNICIAN_ROLE_CODE },
    });
    const technician = technicianRole
      ? await this.userRepo.findOne({
          where: { id: userId, role_id: technicianRole.id, is_active: true },
        })
      : null;
    if (!technician) {
      throw new HttpException(
        'The selected user is not an active technician',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async findOneWithNames(id: string) {
    const ncr = await this.findOrFail(id);
    const [withNames] = await this.attachUserNames([ncr]);
    return withNames;
  }

  // The *_by fields hold user ids. Alongside each one this adds a matching
  // *_by_name (users.full_name) so the web and mobile UIs can show who acted
  // without a separate users lookup. The id fields are left untouched - the
  // mobile app filters a technician's NCRs on raised_by.
  private async attachUserNames(ncrs: NcrTicketEntity[]) {
    const ids = new Set<string>();
    for (const ncr of ncrs) {
      if (ncr.raised_by) ids.add(ncr.raised_by);
      if (ncr.created_by) ids.add(ncr.created_by);
      (ncr.review_detail || []).forEach(
        (r) => r.reviewed_by && ids.add(r.reviewed_by),
      );
      (ncr.approval_details || []).forEach(
        (a) => a.approved_by && ids.add(a.approved_by),
      );
      (ncr.closure_details || []).forEach(
        (c) => c.closure_by && ids.add(c.closure_by),
      );
    }

    // Only real uuids go into the IN (...) - a malformed value in the jsonb
    // would otherwise make Postgres reject the whole query.
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = [...ids].filter((id) => uuidPattern.test(id));
    const users = validIds.length
      ? await this.userRepo.find({
          where: { id: In(validIds) },
          select: ['id', 'full_name'],
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.full_name]));
    const nameOf = (id?: string) => (id ? (names.get(id) ?? null) : null);

    return ncrs.map((ncr) => ({
      ...ncr,
      raised_by_name: nameOf(ncr.raised_by),
      created_by_name: nameOf(ncr.created_by),
      review_detail: (ncr.review_detail || []).map((r) => ({
        ...r,
        reviewed_by_name: nameOf(r.reviewed_by),
      })),
      approval_details: (ncr.approval_details || []).map((a) => ({
        ...a,
        approved_by_name: nameOf(a.approved_by),
      })),
      closure_details: (ncr.closure_details || []).map((c) => ({
        ...c,
        closure_by_name: nameOf(c.closure_by),
      })),
    }));
  }

  // Uses the ncr_ticket_no_seq sequence (db/script.sql). nextval() hands out
  // each number exactly once, even to simultaneous requests, unlike the old
  // COUNT(*) + 1 which gave two parallel requests the same number.
  private async generateTicketId(): Promise<string> {
    const rows: { no: string }[] = await this.ncrTicketRepo.query(
      `SELECT nextval('ncr_ticket_no_seq') AS no`,
    );
    return `NCR_${String(rows[0].no).padStart(6, '0')}`;
  }
}

// Referenced by field ops / dashboard role gating - kept alongside the
// service since it's the source of truth for which role codes this feature
// cares about.
export const NCR_ROLE_CODES = {
  TECHNICIAN: TECHNICIAN_ROLE_CODE,
  PM_DH: PM_DH_ROLE_CODE,
  PROD_HEAD: PROD_HEAD_ROLE_CODE,
  QUALITY: QUALITY_ROLE_CODE,
};
