import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

// Status: Initiated -> Approved (PROD_HEAD) -> Issued (STORES) -> Received
// (TECHNICIAN) -> Returned (TECHNICIAN, optional) -> Dispositioned (STORES).
@Entity('ncr_material_request')
export class NcrMaterialRequestEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  ncr_ticket_id: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ default: 'Initiated' })
  status: string;

  @Column({ type: 'text', nullable: true })
  issue_remarks: string;

  @Column({ type: 'uuid', nullable: true })
  issued_by: string;

  @Column({ type: 'timestamptz', nullable: true })
  issued_at: Date;

  @Column({ type: 'text', nullable: true })
  receipt_remarks: string;

  @Column({ type: 'uuid', nullable: true })
  received_by: string;

  @Column({ type: 'timestamptz', nullable: true })
  received_at: Date;
}
