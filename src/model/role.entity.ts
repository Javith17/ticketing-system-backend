import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('roles')
@Unique(['role_name'])
export class RoleEntity extends BaseEntity {
  @Column()
  role_name: string;

  @Column({ unique: true })
  role_code: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  features: any[];

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  approvals: any[];
}
