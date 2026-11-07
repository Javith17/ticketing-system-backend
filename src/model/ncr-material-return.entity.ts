import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const NCR_RETURN_DISPOSITIONS = [
  'Scrap',
  'Repair & reuse',
  'Return to vendor / warranty claim',
  'Quarantine for Quality',
] as const;

// A failed item the technician returned to Stores (process flow step #43)
// and Stores' disposition of it (step #44).
@Entity('ncr_material_return')
export class NcrMaterialReturnEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ncr_ticket_id: string;

  @Column({ type: 'uuid' })
  ncr_material_request_id: string;

  @Column({ type: 'uuid', nullable: true })
  ncr_material_request_detail_id: string | null;

  @Column()
  item_name: string;

  @Column({ type: 'numeric' })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  serial_no: string | null;

  @Column({ type: 'varchar', nullable: true })
  batch_no: string | null;

  @Column({ type: 'text', nullable: true })
  condition_remarks: string | null;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  attachments: string[];

  @Column({ type: 'uuid', nullable: true })
  returned_by: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  returned_at: Date;

  @Column({ type: 'varchar', nullable: true })
  disposition: string | null;

  @Column({ type: 'text', nullable: true })
  disposition_remarks: string | null;

  @Column({ type: 'uuid', nullable: true })
  disposition_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  disposition_at: Date | null;
}
