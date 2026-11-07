import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One issued quantity of a material request line, with its serial/batch
// number (process flow step #40). Written once when Stores issues.
@Entity('ncr_material_issue')
export class NcrMaterialIssueEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ncr_ticket_id: string;

  @Column({ type: 'uuid' })
  ncr_material_request_id: string;

  @Column({ type: 'uuid' })
  ncr_material_request_detail_id: string;

  @Column({ type: 'numeric' })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  serial_no: string | null;

  @Column({ type: 'varchar', nullable: true })
  batch_no: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
