import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('categories')
@Unique(['category_name'])
export class CategoryEntity extends BaseEntity {
  @Column({ unique: true })
  category_code: string;

  @Column()
  category_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
