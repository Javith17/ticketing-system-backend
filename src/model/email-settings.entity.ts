import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('email_settings')
export class EmailSettingsEntity extends BaseEntity {
  @Column()
  email_id: string;

  // AES-256-GCM encrypted (see src/common/utils/crypto.util.ts) - never
  // returned in API responses.
  @Column({ type: 'text' })
  email_password_encrypted: string;
}
