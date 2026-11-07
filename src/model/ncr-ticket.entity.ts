import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface NcrLinkedTicket {
  ticket_id: string; // uuid of tickets.id
  ticket_no: string; // tickets.ticket_id
}

export interface NcrReviewEntry {
  review_type: string;
  reviewed_by?: string;
  reviewed_at: string;
  review_remarks: string;
}

export interface NcrApprovalEntry {
  approval_type: string;
  approved_by?: string;
  approved_at: string;
  approval_remarks?: string;
}

export interface NcrClosureEntry {
  closure_type: string;
  closure_remarks: string;
  closure_by?: string;
  closure_at: string;
  closure_attachments?: string[];
}

@Entity('ncr_tickets')
export class NcrTicketEntity extends BaseEntity {
  @Column({ unique: true })
  ticket_id: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  linked_tickets: NcrLinkedTicket[];

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 'In-Review' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  raised_by: string;

  // The user who created the row. Same as raised_by for a technician; the
  // admin's id when a super admin raised the NCR on a technician's behalf.
  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  review_detail: NcrReviewEntry[];

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  approval_details: NcrApprovalEntry[];

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  closure_details: NcrClosureEntry[];
}
