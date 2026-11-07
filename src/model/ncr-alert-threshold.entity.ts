import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

// One row per scope (Location/Section/Pole) - see NcrAlertsService for the
// breach-check logic that reads these.
@Entity('ncr_alert_threshold')
export class NcrAlertThresholdEntity extends BaseEntity {
  @Column({ unique: true })
  scope: string;

  @Column({ type: 'int' })
  max_tickets: number;

  @Column({ type: 'int' })
  window_days: number;
}
