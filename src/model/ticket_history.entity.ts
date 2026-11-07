import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ticket_history')
export class TicketHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  event_at: Date;

  @Column()
  event_type: string;

  @Column({ type: 'uuid', nullable: true })
  event_user: string;

  @Column({ type: 'text' })
  event_detail: string;
}
