import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('features')
@Unique(['feature'])
export class FeatureEntity extends BaseEntity {
  @Column()
  feature: string;

  @Column({ type: 'boolean', default: false })
  is_approval: boolean;
}
