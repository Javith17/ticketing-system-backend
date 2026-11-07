import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('tickets')
export class TicketEntity extends BaseEntity {
  @Column({ unique: true })
  ticket_id: string;

  @Column()
  issue: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  asset_id: string;

  @Column({ type: 'int', nullable: true })
  location_id: number;

  @Column({ nullable: true })
  location_name: string;

  @Column({ type: 'int', nullable: true })
  section_id: number;

  @Column({ nullable: true })
  section_name: string;

  @Column({ type: 'int', nullable: true })
  pole_id: number;

  @Column({ nullable: true })
  pole_name: string;

  @Column({ type: 'double precision', nullable: true })
  latitude: number;

  @Column({ type: 'double precision', nullable: true })
  longitude: number;

  @Column()
  source: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  public_user_id: string;

  @Column({ default: 'Open' })
  status: string;

  @Column({ default: 'Medium' })
  priority: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_rsm: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  return_remarks: any[];

  @Column({ type: 'jsonb', nullable: true })
  rsm_assigned: { assigned_by?: string; assigned_at: string };

  @Column({ type: 'jsonb', nullable: true })
  technician_assigned: { assigned_by?: string; assigned_at: string };

  @Column({ type: 'timestamptz', nullable: true })
  due_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date;

  @Column({ nullable: true })
  image_path: string;
}
