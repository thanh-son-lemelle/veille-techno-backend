import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { List } from './list.entity';

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'integer', default: 0 })
  position: number;

  @Index('IDX_cards_list_id')
  @Column({ name: 'list_id', type: 'uuid' })
  listId: string;

  @ManyToOne(() => List, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list: List;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
