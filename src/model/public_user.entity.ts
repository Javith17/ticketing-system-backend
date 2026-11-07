import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('public_users')
export class PublicUserEntity extends BaseEntity {
  @Column()
  guest_id: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @Column()
  os_type: string;
}
