import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { NcrAlertLogEntity } from '../model/ncr-alert-log.entity';
import { NcrTicketEntity } from '../model/ncr-ticket.entity';
import { TicketEntity } from '../model/ticket.entity';
import { TicketDetailsEntity } from '../model/ticket_details.entity';
import { TicketHistoryEntity } from '../model/ticket_history.entity';
import { UserEntity } from '../model/user.entity';
import {
  AlertBreachHistoryDto,
  DateRangeDto,
  HotspotReportDto,
  NcrHotspotReportDto,
  OverdueReportDto,
  ResolutionWorkloadReportDto,
} from '../dto/reports.dto';

const NCR_PIPELINE = [
  'In-Review',
  'Approved',
  'Rejected',
  'Material_request_Initiated',
  'Material_request_approved',
  'Material_issued',
  'Material_received',
  'Item_returned',
  'Return_dispositioned',
  'Technician Closed',
  'PM Closed',
  'Closed',
];

const CLOSED_TICKET_STATUSES = ['Closed', 'Ticket Closed'];

type HotspotScope = 'location' | 'section' | 'pole';

export interface TimelineEvent {
  at: string;
  type: string;
  label: string;
  actor?: string | null;
  remarks?: string;
  source: 'ticket' | 'ticket_history' | 'ticket_details' | 'ncr' | 'ncr_review' | 'ncr_approval' | 'ncr_closure';
}

function hoursBetween(start: Date | string, end: Date | string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Raw COUNT(*) comes back as a string (Postgres bigint) - normalize every
// day-bucketed trend row to a plain number for the frontend.
function normalizeTrend(rows: { day: string; count: string }[]): { day: string; count: number }[] {
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(TicketEntity)
    private ticketRepo: Repository<TicketEntity>,
    @InjectRepository(TicketHistoryEntity)
    private ticketHistoryRepo: Repository<TicketHistoryEntity>,
    @InjectRepository(TicketDetailsEntity)
    private ticketDetailsRepo: Repository<TicketDetailsEntity>,
    @InjectRepository(NcrTicketEntity)
    private ncrTicketRepo: Repository<NcrTicketEntity>,
    @InjectRepository(NcrAlertLogEntity)
    private alertLogRepo: Repository<NcrAlertLogEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  // ---------------------------------------------------------------------
  // Ticket reports
  // ---------------------------------------------------------------------

  async ticketsOverview(dto: DateRangeDto) {
    const byStatus = await this.groupTicketCount('status', dto.from, dto.to);
    const byPriority = await this.groupTicketCount('priority', dto.from, dto.to);
    const bySource = await this.groupTicketCount('source', dto.from, dto.to);

    const trendQb = this.ticketRepo
      .createQueryBuilder('t')
      .select("date_trunc('day', t.created_at)", 'day')
      .addSelect('COUNT(*)', 'count')
      .groupBy("date_trunc('day', t.created_at)")
      .orderBy('day', 'ASC');
    this.applyDateRange(trendQb, 't.created_at', dto.from, dto.to);
    const trend = normalizeTrend(await trendQb.getRawMany());

    return {
      message: 'Tickets overview fetched successfully',
      data: { byStatus, byPriority, bySource, trend },
    };
  }

  async ticketsHotspot(dto: HotspotReportDto) {
    const { scope, parent_id, from, to } = dto;
    const limit = dto.limit ?? 10;
    const { idCol, nameCol, parentCol } = this.hotspotColumns(scope);

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .select(`t.${idCol}`, 'id')
      .addSelect(`t.${nameCol}`, 'name')
      .addSelect('COUNT(*)', 'count')
      .where(`t.${idCol} IS NOT NULL`)
      .groupBy(`t.${idCol}`)
      .addGroupBy(`t.${nameCol}`)
      .orderBy('count', 'DESC')
      .limit(limit);

    if (parentCol && parent_id != null) {
      qb.andWhere(`t.${parentCol} = :parentId`, { parentId: parent_id });
    }
    this.applyDateRange(qb, 't.created_at', from, to);

    const rows = await qb.getRawMany();

    return {
      message: 'Ticket hotspot report fetched successfully',
      data: {
        scope,
        parentId: parent_id ?? null,
        rows: rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
      },
    };
  }

  async ticketsOverdue(dto: OverdueReportDto) {
    const { from, to } = dto;
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const baseQb = () => {
      const qb = this.ticketRepo
        .createQueryBuilder('t')
        .where('t.due_at IS NOT NULL')
        .andWhere('t.due_at < NOW()')
        .andWhere('t.resolved_at IS NULL')
        .andWhere('t.status NOT IN (:...closed)', { closed: CLOSED_TICKET_STATUSES });
      this.applyDateRange(qb, 't.created_at', from, to);
      return qb;
    };

    const count = await baseQb().getCount();
    const list = await baseQb()
      .orderBy('t.due_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const trend = normalizeTrend(
      await baseQb()
        .select("date_trunc('day', t.due_at)", 'day')
        .addSelect('COUNT(*)', 'count')
        .groupBy("date_trunc('day', t.due_at)")
        .orderBy('day', 'ASC')
        .getRawMany(),
    );

    return {
      message: 'Overdue tickets report fetched successfully',
      data: { count, list, trend },
      page,
      limit,
    };
  }

  async resolutionWorkload(dto: ResolutionWorkloadReportDto) {
    const { from, to, group_by } = dto;

    const resolutionQb = this.ticketRepo
      .createQueryBuilder('t')
      .where('t.resolved_at IS NOT NULL')
      .select('AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)))', 'avgSeconds')
      .addSelect('COUNT(*)', 'count');
    this.applyDateRange(resolutionQb, 't.created_at', from, to);

    if (group_by === 'priority') {
      resolutionQb.addSelect('t.priority', 'groupKey').groupBy('t.priority');
    } else if (group_by === 'source') {
      resolutionQb.addSelect('t.source', 'groupKey').groupBy('t.source');
    } else if (group_by === 'location') {
      resolutionQb.addSelect('t.location_name', 'groupKey').groupBy('t.location_name');
    }

    const normalizeResolutionRow = (r: { groupKey?: string; avgSeconds: string | null; count: string }) => ({
      groupKey: r.groupKey,
      avgSeconds: r.avgSeconds != null ? Number(r.avgSeconds) : null,
      count: Number(r.count),
    });
    const resolutionTime = group_by
      ? (await resolutionQb.getRawMany()).map(normalizeResolutionRow)
      : normalizeResolutionRow(await resolutionQb.getRawOne());

    const workloadQb = (column: 'assigned_to' | 'assigned_rsm') => {
      const qb = this.ticketRepo
        .createQueryBuilder('t')
        .leftJoin(UserEntity, 'u', `u.id = t.${column}`)
        .select(`t.${column}`, 'userId')
        .addSelect('u.full_name', 'userName')
        .addSelect('COUNT(*)', 'count')
        .where(`t.${column} IS NOT NULL`)
        .andWhere('t.status NOT IN (:...closed)', { closed: CLOSED_TICKET_STATUSES })
        .groupBy(`t.${column}`)
        .addGroupBy('u.full_name')
        .orderBy('count', 'DESC');
      this.applyDateRange(qb, 't.created_at', from, to);
      return qb;
    };

    const normalizeWorkloadRow = (r: { userId: string; userName: string | null; count: string }) => ({
      userId: r.userId,
      userName: r.userName,
      count: Number(r.count),
    });
    const openByTechnician = (await workloadQb('assigned_to').getRawMany()).map(normalizeWorkloadRow);
    const openByRsm = (await workloadQb('assigned_rsm').getRawMany()).map(normalizeWorkloadRow);

    return {
      message: 'Resolution time & workload report fetched successfully',
      data: { resolutionTime, openByTechnician, openByRsm },
    };
  }

  // ---------------------------------------------------------------------
  // Merged ticket/NCR timeline
  // ---------------------------------------------------------------------

  async timeline(code: string) {
    if (!code) {
      throw new HttpException('A ticket or NCR number is required', HttpStatus.BAD_REQUEST);
    }

    let ticket = await this.ticketRepo.findOne({ where: { ticket_id: code } });
    let ncr: NcrTicketEntity | null = null;
    let ticketIds: string[] = [];

    if (ticket) {
      ticketIds = [ticket.id];
      ncr = await this.findNcrForTicket(ticket.id);
    } else {
      ncr = await this.ncrTicketRepo.findOne({ where: { ticket_id: code } });
      if (!ncr) {
        throw new HttpException(`No ticket or NCR found for code '${code}'`, HttpStatus.NOT_FOUND);
      }
      ticketIds = (ncr.linked_tickets || []).map((lt) => lt.ticket_id);
      if (ticketIds.length === 1) {
        ticket = await this.ticketRepo.findOne({ where: { id: ticketIds[0] } });
      }
    }

    const events: TimelineEvent[] = [];

    if (ticket) {
      events.push({
        at: ticket.created_at.toISOString(),
        type: 'ticket_created',
        label: `Ticket ${ticket.ticket_id} created (${ticket.issue})`,
        source: 'ticket',
      });
    }

    if (ticketIds.length > 0) {
      const history = await this.ticketHistoryRepo
        .createQueryBuilder('h')
        .leftJoin(UserEntity, 'u', 'u.id = h.event_user')
        .where('h.ticket_id IN (:...ticketIds)', { ticketIds })
        .select(['h.event_at AS at', 'h.event_type AS type', 'h.event_detail AS label', 'u.full_name AS actor'])
        .getRawMany();
      for (const h of history) {
        events.push({ at: h.at, type: h.type, label: h.label, actor: h.actor ?? null, source: 'ticket_history' });
      }

      const details = await this.ticketDetailsRepo
        .createQueryBuilder('d')
        .leftJoin(UserEntity, 'u', 'u.id = d.event_by')
        .where('d.ticket_id IN (:...ticketIds)', { ticketIds })
        .select(['d.event_at AS at', 'd.event AS type', 'd.remarks AS remarks', 'u.full_name AS actor'])
        .getRawMany();
      for (const d of details) {
        events.push({
          at: d.at,
          type: d.type,
          label: d.type,
          remarks: d.remarks ?? undefined,
          actor: d.actor ?? null,
          source: 'ticket_details',
        });
      }
    }

    if (ncr) {
      events.push({
        at: ncr.created_at.toISOString(),
        type: 'ncr_raised',
        label: `NCR ${ncr.ticket_id} raised`,
        source: 'ncr',
      });

      const actorIds = new Set<string>();
      for (const r of ncr.review_detail || []) if (r.reviewed_by) actorIds.add(r.reviewed_by);
      for (const a of ncr.approval_details || []) if (a.approved_by) actorIds.add(a.approved_by);
      for (const c of ncr.closure_details || []) if (c.closure_by) actorIds.add(c.closure_by);

      const actors = actorIds.size > 0 ? await this.userRepo.find({ where: { id: In([...actorIds]) } }) : [];
      const actorName = new Map(actors.map((u) => [u.id, u.full_name]));

      for (const r of ncr.review_detail || []) {
        events.push({
          at: r.reviewed_at,
          type: r.review_type,
          label: `NCR ${r.review_type.replace(/_/g, ' ')}`,
          remarks: r.review_remarks,
          actor: r.reviewed_by ? actorName.get(r.reviewed_by) ?? null : null,
          source: 'ncr_review',
        });
      }
      for (const a of ncr.approval_details || []) {
        events.push({
          at: a.approved_at,
          type: a.approval_type,
          label: `NCR ${a.approval_type.replace(/_/g, ' ')}`,
          remarks: a.approval_remarks,
          actor: a.approved_by ? actorName.get(a.approved_by) ?? null : null,
          source: 'ncr_approval',
        });
      }
      for (const c of ncr.closure_details || []) {
        events.push({
          at: c.closure_at,
          type: c.closure_type,
          label: `NCR ${c.closure_type.replace(/_/g, ' ')}`,
          remarks: c.closure_remarks,
          actor: c.closure_by ? actorName.get(c.closure_by) ?? null : null,
          source: 'ncr_closure',
        });
      }
    }

    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      message: 'Timeline fetched successfully',
      data: { ticket: ticket ?? null, ncr: ncr ?? null, timeline: events },
    };
  }

  // ---------------------------------------------------------------------
  // NCR reports
  // ---------------------------------------------------------------------

  async ncrFunnel(dto: DateRangeDto) {
    const qb = this.ncrTicketRepo
      .createQueryBuilder('n')
      .select('n.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('n.status');
    this.applyDateRange(qb, 'n.created_at', dto.from, dto.to);
    const rows = await qb.getRawMany();
    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count)]));
    const data = NCR_PIPELINE.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));

    return { message: 'NCR funnel report fetched successfully', data };
  }

  async ncrAging(dto: DateRangeDto) {
    const qb = this.ncrTicketRepo.createQueryBuilder('n');
    this.applyDateRange(qb, 'n.created_at', dto.from, dto.to);
    const ncrs = await qb.getMany();

    const raisedToReviewed: number[] = [];
    const reviewedToApproved: number[] = [];
    const approvedToClosed: number[] = [];
    const totalCycle: number[] = [];

    for (const n of ncrs) {
      const firstReviewedAt = n.review_detail?.[0]?.reviewed_at;
      const firstApprovedAt = n.approval_details?.[0]?.approved_at;
      const lastClosureAt = n.closure_details?.length
        ? n.closure_details[n.closure_details.length - 1].closure_at
        : undefined;

      if (firstReviewedAt) raisedToReviewed.push(hoursBetween(n.created_at, firstReviewedAt));
      if (firstReviewedAt && firstApprovedAt) {
        reviewedToApproved.push(hoursBetween(firstReviewedAt, firstApprovedAt));
      }
      if (firstApprovedAt && lastClosureAt) {
        approvedToClosed.push(hoursBetween(firstApprovedAt, lastClosureAt));
      }
      if (lastClosureAt) totalCycle.push(hoursBetween(n.created_at, lastClosureAt));
    }

    return {
      message: 'NCR aging report fetched successfully',
      data: {
        avgRaisedToReviewedHours: avg(raisedToReviewed),
        avgReviewedToApprovedHours: avg(reviewedToApproved),
        avgApprovedToClosedHours: avg(approvedToClosed),
        avgTotalCycleHours: avg(totalCycle),
        sampleSize: ncrs.length,
      },
    };
  }

  async ncrHotspot(dto: NcrHotspotReportDto) {
    const { scope, parent_id, from, to } = dto;
    const limit = dto.limit ?? 10;
    const { idCol, nameCol, parentCol } = this.hotspotColumns(scope);

    const conditions: string[] = [`t.${idCol} IS NOT NULL`, 'ncr.is_active = true'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (parentCol && parent_id != null) {
      conditions.push(`t.${parentCol} = $${paramIndex++}`);
      params.push(parent_id);
    }
    if (from) {
      conditions.push(`ncr.created_at >= $${paramIndex++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`ncr.created_at <= $${paramIndex++}`);
      params.push(to);
    }
    const limitParam = paramIndex++;
    params.push(limit);

    const rows = await this.ticketRepo.manager.query(
      `SELECT t.${idCol} AS id, t.${nameCol} AS name, COUNT(DISTINCT ncr.id) AS count
       FROM ncr_tickets ncr, jsonb_array_elements(ncr.linked_tickets) AS lt
       JOIN tickets t ON t.id = (lt->>'ticket_id')::uuid
       WHERE ${conditions.join(' AND ')}
       GROUP BY t.${idCol}, t.${nameCol}
       ORDER BY count DESC
       LIMIT $${limitParam}`,
      params,
    );

    return {
      message: 'NCR hotspot report fetched successfully',
      data: {
        scope,
        parentId: parent_id ?? null,
        rows: rows.map((r: { id: unknown; name: string; count: string }) => ({
          id: r.id,
          name: r.name,
          count: Number(r.count),
        })),
      },
    };
  }

  // ---------------------------------------------------------------------
  // Alert reports
  // ---------------------------------------------------------------------

  async alertBreachHistory(dto: AlertBreachHistoryDto) {
    const { scope, from, to } = dto;
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const baseQb = () => {
      const qb = this.alertLogRepo.createQueryBuilder('a');
      if (scope) qb.andWhere('a.scope = :scope', { scope });
      this.applyDateRange(qb, 'a.alert_date', from, to);
      return qb;
    };

    const [list, total] = await baseQb()
      .orderBy('a.alert_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const unresolvedCount = await baseQb().andWhere('a.ncr_ticket_id IS NULL').getCount();

    const trend = normalizeTrend(
      await baseQb()
        .select("date_trunc('day', a.alert_date)", 'day')
        .addSelect('COUNT(*)', 'count')
        .groupBy("date_trunc('day', a.alert_date)")
        .orderBy('day', 'ASC')
        .getRawMany(),
    );

    return {
      message: 'Alert breach history fetched successfully',
      data: { list, total, unresolvedCount, trend },
      page,
      limit,
    };
  }

  async timeToNcr(dto: DateRangeDto) {
    const { from, to } = dto;

    const baseQb = () => {
      const qb = this.alertLogRepo
        .createQueryBuilder('a')
        .innerJoin(NcrTicketEntity, 'ncr', 'ncr.id = a.ncr_ticket_id')
        .where('a.ncr_ticket_id IS NOT NULL');
      this.applyDateRange(qb, 'a.alert_date', from, to);
      return qb;
    };

    const overall = await baseQb()
      .select('AVG(EXTRACT(EPOCH FROM (ncr.created_at - a.alert_date))) / 3600', 'avgHours')
      .addSelect('COUNT(*)', 'count')
      .getRawOne();

    const byScopeRows = await baseQb()
      .select('a.scope', 'scope')
      .addSelect('AVG(EXTRACT(EPOCH FROM (ncr.created_at - a.alert_date))) / 3600', 'avgHours')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.scope')
      .getRawMany();

    return {
      message: 'Time to NCR report fetched successfully',
      data: {
        avgHoursToNcr: overall?.avgHours != null ? Number(overall.avgHours) : null,
        sampleSize: Number(overall?.count ?? 0),
        byScope: byScopeRows.map((r) => ({
          scope: r.scope,
          avgHours: r.avgHours != null ? Number(r.avgHours) : null,
          count: Number(r.count),
        })),
      },
    };
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  private async groupTicketCount(column: 'status' | 'priority' | 'source', from?: string, to?: string) {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .select(`t.${column}`, column)
      .addSelect('COUNT(*)', 'count')
      .groupBy(`t.${column}`);
    this.applyDateRange(qb, 't.created_at', from, to);
    const rows = await qb.getRawMany();
    return rows.map((r) => ({ [column]: r[column], count: Number(r.count) }));
  }

  private hotspotColumns(scope: HotspotScope): { idCol: string; nameCol: string; parentCol: string | null } {
    if (scope === 'location') return { idCol: 'location_id', nameCol: 'location_name', parentCol: null };
    if (scope === 'section') return { idCol: 'section_id', nameCol: 'section_name', parentCol: 'location_id' };
    return { idCol: 'pole_id', nameCol: 'pole_name', parentCol: 'section_id' };
  }

  private applyDateRange<T extends object>(
    qb: SelectQueryBuilder<T>,
    column: string,
    from?: string,
    to?: string,
  ): void {
    if (from) qb.andWhere(`${column} >= :from`, { from });
    if (to) qb.andWhere(`${column} <= :to`, { to });
  }

  private async findNcrForTicket(ticketUuid: string): Promise<NcrTicketEntity | null> {
    const rows = await this.ticketRepo.manager.query(
      `SELECT ncr.* FROM ncr_tickets ncr, jsonb_array_elements(ncr.linked_tickets) AS lt
       WHERE (lt->>'ticket_id')::uuid = $1 AND ncr.is_active = true
       ORDER BY ncr.created_at ASC LIMIT 1`,
      [ticketUuid],
    );
    return rows[0] ?? null;
  }
}
