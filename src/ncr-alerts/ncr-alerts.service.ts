import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NcrAlertLogEntity } from '../model/ncr-alert-log.entity';
import { NcrAlertThresholdEntity } from '../model/ncr-alert-threshold.entity';
import { TicketEntity } from '../model/ticket.entity';
import { NcrTicketsService } from '../ncr-tickets/ncr-tickets.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NCR_ALERT_SCOPES,
  NcrAlertListDto,
  NcrAlertScope,
  SaveNcrThresholdsDto,
} from '../dto/ncr-alert.dto';

const NOTIFY_ROLE_CODES = ['QUALITY', 'PM_DH', 'PROD_HEAD'];

interface BreachCandidate {
  scope: NcrAlertScope;
  entityId: number;
  entityName: string;
}

// The subset of ticket fields the breach check needs - just the new
// pole/section/location columns off the ticket just created.
interface TicketScopeFields {
  location_id?: number | null;
  location_name?: string | null;
  section_id?: number | null;
  section_name?: string | null;
  pole_id?: number | null;
  pole_name?: string | null;
}

@Injectable()
export class NcrAlertsService {
  constructor(
    @InjectRepository(NcrAlertThresholdEntity)
    private thresholdRepo: Repository<NcrAlertThresholdEntity>,
    @InjectRepository(NcrAlertLogEntity)
    private alertLogRepo: Repository<NcrAlertLogEntity>,
    @InjectRepository(TicketEntity)
    private ticketRepo: Repository<TicketEntity>,
    private notificationsService: NotificationsService,
    private ncrTicketsService: NcrTicketsService,
  ) {}

  async getThresholds() {
    const rows = await this.thresholdRepo.find();
    const byScope = new Map(rows.map((r) => [r.scope, r]));
    const data = NCR_ALERT_SCOPES.map((scope) => {
      const row = byScope.get(scope);
      return {
        scope,
        max_tickets: row?.max_tickets ?? null,
        window_days: row?.window_days ?? null,
      };
    });

    return { message: 'NCR thresholds fetched successfully', data };
  }

  async saveThresholds(dto: SaveNcrThresholdsDto) {
    for (const item of dto.thresholds) {
      const existing = await this.thresholdRepo.findOne({
        where: { scope: item.scope },
      });
      if (existing) {
        await this.thresholdRepo.update(existing.id, {
          max_tickets: item.max_tickets,
          window_days: item.window_days,
        });
      } else {
        await this.thresholdRepo.save({
          scope: item.scope,
          max_tickets: item.max_tickets,
          window_days: item.window_days,
        });
      }
    }

    return this.getThresholds();
  }

  async findAlerts(listDto: NcrAlertListDto) {
    const page = listDto.page || 1;
    const limit = listDto.limit || 20;

    const [data, total] = await this.alertLogRepo.findAndCount({
      order: { alert_date: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { message: 'NCR alerts fetched successfully', data, total, page, limit };
  }

  async getUnseenCount() {
    const count = await this.alertLogRepo.count({ where: { seen: false } });
    return { message: 'Unseen NCR alert count fetched successfully', data: { count } };
  }

  async markSeen() {
    await this.alertLogRepo.update({ seen: false }, { seen: true });
    return { message: 'NCR alerts marked as seen' };
  }

  // Called right after a ticket is saved (TicketsService.create) with that
  // ticket's own location/section/pole fields. For each scope present on the
  // new ticket, checks the rolling ticket count for that location/section/
  // pole against the configured threshold and logs + emails on breach.
  // Fire-and-forget, synchronous, no dedup - matches this codebase's
  // existing notification side-effect style (see TicketsService/
  // NcrTicketsService).
  async checkAndLogBreaches(ticket: TicketScopeFields): Promise<void> {
    const thresholds = await this.thresholdRepo.find();
    const thresholdByScope = new Map(thresholds.map((t) => [t.scope, t]));
    if (thresholdByScope.size === 0) return;

    const scopedFields: [NcrAlertScope, number | null | undefined, string | null | undefined][] = [
      ['Location', ticket.location_id, ticket.location_name],
      ['Section', ticket.section_id, ticket.section_name],
      ['Pole', ticket.pole_id, ticket.pole_name],
    ];
    const candidates: BreachCandidate[] = [];
    for (const [scope, entityId, entityName] of scopedFields) {
      if (entityId == null || entityName == null) continue;
      candidates.push({ scope, entityId, entityName });
    }

    for (const candidate of candidates) {
      const threshold = thresholdByScope.get(candidate.scope);
      if (!threshold) continue;

      const count = await this.countTicketsForScope(
        candidate.scope,
        candidate.entityId,
        threshold.window_days,
      );
      if (count < threshold.max_tickets) continue;

      await this.alertLogRepo.save({
        scope: candidate.scope,
        entity_name: candidate.entityName,
        entity_id: candidate.entityId,
        ticket_count: count,
        window_days: threshold.window_days,
        seen: false,
      });

      const title = `Ticket threshold reached for ${candidate.scope} '${candidate.entityName}'`;
      const body = `${count} tickets in the last ${threshold.window_days} days (threshold: ${threshold.max_tickets}).`;
      await Promise.all(
        NOTIFY_ROLE_CODES.map((roleCode) =>
          this.notificationsService.sendToRoleCode(roleCode, title, body),
        ),
      );
    }
  }

  // Counts tickets created within the rolling window for the given
  // scope/entity, directly off the tickets table's own denormalized
  // location_id/section_id/pole_id columns.
  private async countTicketsForScope(
    scope: NcrAlertScope,
    entityId: number,
    windowDays: number,
  ): Promise<number> {
    const column = this.scopeColumn(scope);

    const result = await this.ticketRepo.manager.query(
      `SELECT COUNT(*) AS count
       FROM tickets
       WHERE ${column} = $1
         AND created_at >= NOW() - INTERVAL '1 day' * $2`,
      [entityId, windowDays],
    );

    return parseInt(result[0]?.count ?? '0', 10);
  }

  // Raises one NCR linking every ticket currently matching the alert's
  // scope/entity (the same set the "View tickets" button on the frontend
  // shows), and remembers the resulting NCR id on the alert row so a
  // second click shows "View NCR" instead of raising a duplicate.
  async raiseNcrForAlert(alertId: string, userId: string) {
    const alert = await this.alertLogRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
    }

    if (alert.ncr_ticket_id) {
      return this.ncrTicketsService.findOne(alert.ncr_ticket_id);
    }

    if (alert.entity_id == null) {
      throw new HttpException(
        'Alert has no associated entity to raise an NCR against',
        HttpStatus.BAD_REQUEST,
      );
    }

    const column = this.scopeColumn(alert.scope as NcrAlertScope);
    const tickets = await this.ticketRepo.find({
      where: { [column]: alert.entity_id } as Record<string, number>,
    });
    if (tickets.length === 0) {
      throw new HttpException('No tickets found for this alert', HttpStatus.NOT_FOUND);
    }

    const description = `Threshold breach: ${alert.ticket_count} tickets for ${alert.scope} '${alert.entity_name}' within ${alert.window_days} days.`;
    const result = await this.ncrTicketsService.createFromTickets(
      tickets.map((t) => t.id),
      description,
      userId,
    );

    await this.alertLogRepo.update(alert.id, { ncr_ticket_id: result.data.id });

    return result;
  }

  private scopeColumn(scope: NcrAlertScope): 'location_id' | 'section_id' | 'pole_id' {
    return scope === 'Location' ? 'location_id' : scope === 'Section' ? 'section_id' : 'pole_id';
  }
}
