import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('sources')
@Unique(['source_name'])
export class SourceEntity extends BaseEntity {
  @Column()
  source_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
