import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// No is_active/soft-delete on this table - line items are only ever created
// once per material request and updated in place (approved_qty, issued_qty), so it does
// not extend the shared BaseEntity.
@Entity('ncr_material_request_detail')
export class NcrMaterialRequestDetailEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ncr_ticket_id: string;

  @Column({ type: 'uuid' })
  ncr_material_request_id: string;

  @Column()
  material_name: string;

  @Column({ type: 'numeric' })
  material_qty: number;

  @Column({ type: 'numeric', nullable: true })
  approved_qty: number;

  // Total issued by Stores (sum of this line's ncr_material_issue rows).
  @Column({ type: 'numeric', nullable: true })
  issued_qty: number;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
