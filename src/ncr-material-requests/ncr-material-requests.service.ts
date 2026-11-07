import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { In, Repository } from 'typeorm';
import { saveTicketImage } from '../common/utils/ticket-image.util';
import {
  ApproveNcrMaterialRequestDto,
  CreateNcrMaterialRequestDto,
  IssueNcrMaterialDto,
  ReceiveNcrMaterialDto,
  RecordDispositionDto,
  ReturnItemDto,
} from '../dto/ncr-material-request.dto';
import { NcrMaterialIssueEntity } from '../model/ncr-material-issue.entity';
import { NcrMaterialRequestDetailEntity } from '../model/ncr-material-request-detail.entity';
import { NcrMaterialRequestEntity } from '../model/ncr-material-request.entity';
import { NcrMaterialReturnEntity } from '../model/ncr-material-return.entity';
import { NcrTicketEntity } from '../model/ncr-ticket.entity';
import { UserEntity } from '../model/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

const PROD_HEAD_ROLE_CODE = 'PROD_HEAD';
const STORES_ROLE_CODE = 'STORES';
const QUALITY_ROLE_CODE = 'QUALITY';
const ADMIN_ROLE_CODE = 'ADMIN';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (message: string) =>
  new HttpException(message, HttpStatus.BAD_REQUEST);

@Injectable()
export class NcrMaterialRequestsService {
  constructor(
    @InjectRepository(NcrMaterialRequestEntity)
    private materialRequestRepo: Repository<NcrMaterialRequestEntity>,
    @InjectRepository(NcrMaterialRequestDetailEntity)
    private materialRequestDetailRepo: Repository<NcrMaterialRequestDetailEntity>,
    @InjectRepository(NcrTicketEntity)
    private ncrTicketRepo: Repository<NcrTicketEntity>,
    @InjectRepository(NcrMaterialIssueEntity)
    private issueRepo: Repository<NcrMaterialIssueEntity>,
    @InjectRepository(NcrMaterialReturnEntity)
    private returnRepo: Repository<NcrMaterialReturnEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateNcrMaterialRequestDto) {
    const ncr = await this.ncrTicketRepo.findOne({
      where: { id: dto.ncr_ticket_id },
    });
    if (!ncr) {
      throw new HttpException('NCR ticket not found', HttpStatus.NOT_FOUND);
    }
    if (ncr.status !== 'Approved') {
      throw new HttpException(
        `Cannot create a material request while NCR status is '${ncr.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const request = await this.materialRequestRepo.save({
      ncr_ticket_id: ncr.id,
      remarks: dto.remarks,
      status: 'Initiated',
    });

    const details = await this.materialRequestDetailRepo.save(
      dto.materials.map((material) => ({
        ncr_ticket_id: ncr.id,
        ncr_material_request_id: request.id,
        material_name: material.material_name,
        material_qty: material.material_qty,
      })),
    );

    await this.ncrTicketRepo.update(ncr.id, {
      status: 'Material_request_Initiated',
    });

    this.notificationsService.sendToRoleCode(
      PROD_HEAD_ROLE_CODE,
      'Material request awaiting approval',
      `A material request for NCR ${ncr.ticket_id} is awaiting your approval.`,
      { ncr_ticket_id: ncr.id, ncr_material_request_id: request.id },
    );

    return {
      message: 'Material request created successfully',
      data: { ...request, materials: details },
    };
  }

  async findByNcrTicket(ncrTicketId: string) {
    const request = await this.materialRequestRepo.findOne({
      where: { ncr_ticket_id: ncrTicketId },
      order: { created_at: 'DESC' },
    });
    if (!request) {
      throw new HttpException(
        'Material request not found for this NCR ticket',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      message: 'Material request fetched successfully',
      data: await this.buildDetail(request),
    };
  }

  async approve(id: string, dto: ApproveNcrMaterialRequestDto) {
    const request = await this.materialRequestRepo.findOne({ where: { id } });
    if (!request) {
      throw new HttpException(
        'Material request not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (request.status !== 'Initiated') {
      throw new HttpException(
        `Cannot approve material request while status is '${request.status}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Every line in the payload must belong to this material request, each
    // line may appear only once, and every line of the request must be given
    // an approved quantity. Without this, ids from another NCR's request could
    // be sent and their approved_qty overwritten.
    const existingLines = await this.materialRequestDetailRepo.find({
      where: { ncr_material_request_id: id },
      select: ['id'],
    });
    const existingIds = new Set(existingLines.map((line) => line.id));
    const submittedIds = dto.materials.map((line) => line.id);

    const unknownIds = submittedIds.filter(
      (lineId) => !existingIds.has(lineId),
    );
    if (unknownIds.length) {
      throw new HttpException(
        `Material lines do not belong to this material request: ${unknownIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new HttpException(
        'Each material line can only be approved once per request',
        HttpStatus.BAD_REQUEST,
      );
    }
    const missingIds = [...existingIds].filter(
      (lineId) => !submittedIds.includes(lineId),
    );
    if (missingIds.length) {
      throw new HttpException(
        'An approved quantity is required for every material line',
        HttpStatus.BAD_REQUEST,
      );
    }

    await Promise.all(
      dto.materials.map((line) =>
        this.materialRequestDetailRepo.update(line.id, {
          approved_qty: line.approved_qty,
        }),
      ),
    );

    await this.materialRequestRepo.update(id, {
      status: 'Approved',
      ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
    });

    const ncr = await this.ncrTicketRepo.findOne({
      where: { id: request.ncr_ticket_id },
    });
    if (ncr) {
      await this.ncrTicketRepo.update(ncr.id, {
        status: 'Material_request_approved',
      });

      if (ncr.raised_by) {
        this.notificationsService.sendToUser(
          ncr.raised_by,
          'Material request approved',
          `Your material request for NCR ${ncr.ticket_id} has been approved and sent to Stores for issue.`,
          { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
        );
      }
      // Process flow step #39 - the approved request goes to Stores.
      this.notificationsService.sendToRoleCode(
        STORES_ROLE_CODE,
        'Material request ready for issue',
        `The approved material request for NCR ${ncr.ticket_id} is ready to be issued.`,
        { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
      );
    }

    const materials = await this.materialRequestDetailRepo.find({
      where: { ncr_material_request_id: id },
    });
    const updated = await this.materialRequestRepo.findOne({ where: { id } });

    return {
      message: 'Material request approved successfully',
      data: { ...updated, materials },
    };
  }

  // Process flow step #40 - Stores issues the approved material with serial /
  // batch numbers. Single issue event: a line may be issued short of its
  // approved quantity (stock shortage), never above it.
  async issue(id: string, dto: IssueNcrMaterialDto, userId?: string) {
    const { request, ncr } = await this.loadForStep(
      id,
      'Approved',
      'Material_request_approved',
      'issue material',
    );

    const lines = await this.materialRequestDetailRepo.find({
      where: { ncr_material_request_id: id },
    });
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const unknown = dto.items.filter((row) => !lineById.has(row.detail_id));
    if (unknown.length) {
      throw badRequest(
        `Material lines do not belong to this material request: ${unknown.map((r) => r.detail_id).join(', ')}`,
      );
    }

    const issuedByLine = new Map<string, number>();
    for (const row of dto.items) {
      issuedByLine.set(
        row.detail_id,
        (issuedByLine.get(row.detail_id) ?? 0) + Number(row.quantity),
      );
    }
    for (const [lineId, issued] of issuedByLine) {
      const line = lineById.get(lineId)!;
      const approved = Number(line.approved_qty ?? line.material_qty);
      if (issued > approved + 1e-9) {
        throw badRequest(
          `Issued quantity for '${line.material_name}' (${issued}) is more than the approved quantity (${approved})`,
        );
      }
    }

    await this.materialRequestRepo.manager.transaction(async (manager) => {
      await manager.getRepository(NcrMaterialIssueEntity).save(
        dto.items.map((row) => ({
          ncr_ticket_id: ncr.id,
          ncr_material_request_id: id,
          ncr_material_request_detail_id: row.detail_id,
          quantity: row.quantity,
          serial_no: row.serial_no?.trim() || null,
          batch_no: row.batch_no?.trim() || null,
        })),
      );
      for (const line of lines) {
        await manager
          .getRepository(NcrMaterialRequestDetailEntity)
          .update(line.id, { issued_qty: issuedByLine.get(line.id) ?? 0 });
      }
      await manager.getRepository(NcrMaterialRequestEntity).update(id, {
        status: 'Issued',
        issue_remarks: dto.remarks,
        issued_by: userId,
        issued_at: new Date(),
      });
      await manager
        .getRepository(NcrTicketEntity)
        .update(ncr.id, { status: 'Material_issued' });
    });

    if (ncr.raised_by) {
      this.notificationsService.sendToUser(
        ncr.raised_by,
        'Material issued',
        `Material for NCR ${ncr.ticket_id} has been issued by Stores. Please collect it and confirm receipt.`,
        { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
      );
    }

    return {
      message: 'Material issued successfully',
      data: await this.buildDetail(await this.reload(request.id)),
    };
  }

  // Process flow step #42 - the technician confirms receipt.
  async receive(
    id: string,
    dto: ReceiveNcrMaterialDto,
    userId?: string,
    roleCode?: string,
  ) {
    const { request, ncr } = await this.loadForStep(
      id,
      'Issued',
      'Material_issued',
      'confirm receipt',
    );
    this.ensureOwnTechnicianOrAdmin(ncr, userId, roleCode);

    await this.materialRequestRepo.manager.transaction(async (manager) => {
      await manager.getRepository(NcrMaterialRequestEntity).update(id, {
        status: 'Received',
        receipt_remarks: dto.remarks,
        received_by: userId,
        received_at: new Date(),
      });
      await manager
        .getRepository(NcrTicketEntity)
        .update(ncr.id, { status: 'Material_received' });
    });

    this.notificationsService.sendToRoleCode(
      STORES_ROLE_CODE,
      'Material received',
      `The technician has confirmed receipt of the material for NCR ${ncr.ticket_id}.`,
      { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
    );

    return {
      message: 'Material receipt recorded successfully',
      data: await this.buildDetail(await this.reload(request.id)),
    };
  }

  // Process flow step #43 - the technician returns the failed item(s).
  // Optional: if nothing failed, the technician closes the NCR straight from
  // Material_received instead. Multipart: 'items' is a JSON array of
  // ReturnItemDto, plus up to 3 photos under 'attachments'.
  async returnItems(
    id: string,
    rawItems: unknown,
    attachments: Express.Multer.File[] | undefined,
    userId?: string,
    roleCode?: string,
  ) {
    const { request, ncr } = await this.loadForStep(
      id,
      'Received',
      'Material_received',
      'return failed items',
    );
    this.ensureOwnTechnicianOrAdmin(ncr, userId, roleCode);

    const items = await this.parseReturnItems(rawItems);
    const lineIds = new Set(
      (
        await this.materialRequestDetailRepo.find({
          where: { ncr_material_request_id: id },
          select: ['id'],
        })
      ).map((line) => line.id),
    );
    const foreign = items.filter(
      (item) => item.detail_id && !lineIds.has(item.detail_id),
    );
    if (foreign.length) {
      throw badRequest(
        'Returned items can only reference lines of this material request',
      );
    }

    const attachmentPaths = (attachments || []).map((file) =>
      saveTicketImage('ncr-returns', id, file),
    );

    await this.materialRequestRepo.manager.transaction(async (manager) => {
      await manager.getRepository(NcrMaterialReturnEntity).save(
        items.map((item) => ({
          ncr_ticket_id: ncr.id,
          ncr_material_request_id: id,
          ncr_material_request_detail_id: item.detail_id || null,
          item_name: item.item_name.trim(),
          quantity: item.quantity,
          serial_no: item.serial_no?.trim() || null,
          batch_no: item.batch_no?.trim() || null,
          condition_remarks: item.condition_remarks?.trim() || null,
          attachments: attachmentPaths,
          returned_by: userId,
          returned_at: new Date(),
        })),
      );
      await manager
        .getRepository(NcrMaterialRequestEntity)
        .update(id, { status: 'Returned' });
      await manager
        .getRepository(NcrTicketEntity)
        .update(ncr.id, { status: 'Item_returned' });
    });

    this.notificationsService.sendToRoleCode(
      STORES_ROLE_CODE,
      'Failed item returned',
      `Failed item(s) for NCR ${ncr.ticket_id} have been returned. Please record the disposition.`,
      { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
    );

    return {
      message: 'Failed items returned successfully',
      data: await this.buildDetail(await this.reload(request.id)),
    };
  }

  // Process flow step #44 - Stores records the disposition of every
  // returned item.
  async recordDisposition(
    id: string,
    dto: RecordDispositionDto,
    userId?: string,
  ) {
    const { request, ncr } = await this.loadForStep(
      id,
      'Returned',
      'Item_returned',
      'record disposition',
    );

    const returns = await this.returnRepo.find({
      where: { ncr_material_request_id: id },
      select: ['id'],
    });
    const returnIds = new Set(returns.map((r) => r.id));
    const submittedIds = dto.items.map((item) => item.return_id);
    if (submittedIds.some((rid) => !returnIds.has(rid))) {
      throw badRequest('Returned items do not belong to this material request');
    }
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw badRequest('Each returned item can only be dispositioned once');
    }
    if ([...returnIds].some((rid) => !submittedIds.includes(rid))) {
      throw badRequest('A disposition is required for every returned item');
    }

    const now = new Date();
    await this.materialRequestRepo.manager.transaction(async (manager) => {
      for (const item of dto.items) {
        await manager
          .getRepository(NcrMaterialReturnEntity)
          .update(item.return_id, {
            disposition: item.disposition,
            disposition_remarks: item.remarks?.trim() || null,
            disposition_by: userId,
            disposition_at: now,
          });
      }
      await manager
        .getRepository(NcrMaterialRequestEntity)
        .update(id, { status: 'Dispositioned' });
      await manager
        .getRepository(NcrTicketEntity)
        .update(ncr.id, { status: 'Return_dispositioned' });
    });

    if (ncr.raised_by) {
      this.notificationsService.sendToUser(
        ncr.raised_by,
        'Returned item disposition recorded',
        `Stores has recorded the disposition of the returned item(s) for NCR ${ncr.ticket_id}. You can now submit the NCR closure.`,
        { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
      );
    }
    if (dto.items.some((i) => i.disposition === 'Quarantine for Quality')) {
      this.notificationsService.sendToRoleCode(
        QUALITY_ROLE_CODE,
        'Returned item quarantined',
        `A returned item for NCR ${ncr.ticket_id} has been quarantined for Quality.`,
        { ncr_ticket_id: ncr.id, ncr_material_request_id: id },
      );
    }

    return {
      message: 'Disposition recorded successfully',
      data: await this.buildDetail(await this.reload(request.id)),
    };
  }

  private async loadForStep(
    id: string,
    requestStatus: string,
    ncrStatus: string,
    action: string,
  ) {
    const request = await this.materialRequestRepo.findOne({ where: { id } });
    if (!request) {
      throw new HttpException(
        'Material request not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const ncr = await this.ncrTicketRepo.findOne({
      where: { id: request.ncr_ticket_id },
    });
    if (!ncr) {
      throw new HttpException('NCR ticket not found', HttpStatus.NOT_FOUND);
    }
    if (request.status !== requestStatus || ncr.status !== ncrStatus) {
      throw badRequest(
        `Cannot ${action} while the material request is '${request.status}' and the NCR is '${ncr.status}'`,
      );
    }
    return { request, ncr };
  }

  // Receipt and return belong to the technician who raised the NCR (the
  // super admin may act for them). The mobile app only lists a technician's
  // own NCRs, but that filter is client-side, so it is enforced here too.
  private ensureOwnTechnicianOrAdmin(
    ncr: NcrTicketEntity,
    userId?: string,
    roleCode?: string,
  ) {
    if (roleCode === ADMIN_ROLE_CODE) return;
    if (!userId || ncr.raised_by !== userId) {
      throw new HttpException(
        'Only the technician who raised this NCR can perform this action',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async parseReturnItems(raw: unknown): Promise<ReturnItemDto[]> {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw badRequest("'items' must be a JSON array of returned items");
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw badRequest('Add at least one returned item');
    }
    const items = plainToInstance(ReturnItemDto, parsed);
    for (const item of items) {
      const errors = await validate(item, { whitelist: true });
      if (errors.length) {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}),
        );
        throw badRequest(messages.join(', '));
      }
    }
    return items;
  }

  private async reload(id: string) {
    return (await this.materialRequestRepo.findOne({ where: { id } }))!;
  }

  // Request + lines (each with its issue rows) + returned items, with the
  // names of the users behind every *_by field.
  private async buildDetail(request: NcrMaterialRequestEntity) {
    const [lines, issues, returns] = await Promise.all([
      this.materialRequestDetailRepo.find({
        where: { ncr_material_request_id: request.id },
        order: { created_at: 'ASC' },
      }),
      this.issueRepo.find({
        where: { ncr_material_request_id: request.id },
        order: { created_at: 'ASC' },
      }),
      this.returnRepo.find({
        where: { ncr_material_request_id: request.id },
        order: { returned_at: 'ASC' },
      }),
    ]);

    const userIds = [
      request.issued_by,
      request.received_by,
      ...returns.flatMap((r) => [r.returned_by, r.disposition_by]),
    ].filter((uid): uid is string => !!uid && UUID_PATTERN.test(uid));
    const users = userIds.length
      ? await this.userRepo.find({
          where: { id: In([...new Set(userIds)]) },
          select: ['id', 'full_name'],
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.full_name]));
    const nameOf = (uid?: string | null) =>
      uid ? (names.get(uid) ?? null) : null;

    return {
      ...request,
      issued_by_name: nameOf(request.issued_by),
      received_by_name: nameOf(request.received_by),
      materials: lines.map((line) => ({
        ...line,
        issues: issues.filter(
          (row) => row.ncr_material_request_detail_id === line.id,
        ),
      })),
      returns: returns.map((r) => ({
        ...r,
        returned_by_name: nameOf(r.returned_by),
        disposition_by_name: nameOf(r.disposition_by),
      })),
    };
  }
}
