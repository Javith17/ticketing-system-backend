import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('assets')
export class AssetEntity extends BaseEntity {
  @Column()
  asset_name: string;

  @Column({ nullable: true })
  panel: string;

  @Column({ nullable: true })
  site: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'jsonb', nullable: true })
  coordinates: any;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  barcode: string;
}
