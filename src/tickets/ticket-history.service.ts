import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketHistoryEntity } from '../model/ticket_history.entity';

@Injectable()
export class TicketHistoryService {
  constructor(
    @InjectRepository(TicketHistoryEntity)
    private historyRepo: Repository<TicketHistoryEntity>,
  ) {}

  record(
    ticketId: string,
    eventType: 'created' | 'status_update',
    eventUser: string | undefined,
    detail: string,
  ) {
    return this.historyRepo.save({
      ticket_id: ticketId,
      event_type: eventType,
      event_user: eventUser,
      event_detail: detail,
    });
  }
}
