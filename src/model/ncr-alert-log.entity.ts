import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

// One row per threshold breach detected in NcrTicketsService.create ->
// NcrAlertsService.checkAndLogBreaches - a point-in-time snapshot, not
// deduplicated against prior breaches in the same window.
@Entity('ncr_alert_log')
export class NcrAlertLogEntity extends BaseEntity {
  @Column()
  scope: string;

  @Column()
  entity_name: string;

  @Column({ type: 'int', nullable: true })
  entity_id: number;

  @Column({ type: 'int' })
  ticket_count: number;

  @Column({ type: 'int' })
  window_days: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  alert_date: Date;

  @Column({ type: 'boolean', default: false })
  seen: boolean;

  // Set once an NCR is raised directly from this alert - see
  // NcrAlertsService.raiseNcrForAlert.
  @Column({ type: 'uuid', nullable: true })
  ncr_ticket_id: string;
}
