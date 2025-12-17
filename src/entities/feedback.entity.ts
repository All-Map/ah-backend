import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne,
  JoinColumn 
} from 'typeorm';
import { User } from './user.entity';

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  subject: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: ['general', 'bug', 'feature', 'feedback', 'support'],
    default: 'general'
  })
  category: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'reviewed', 'resolved', 'archived'],
    default: 'pending'
  })
  status: string;

  @CreateDateColumn({ 
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;
}

export enum FeedbackCategory {
  GENERAL = 'general',
  BUG = 'bug',
  FEATURE = 'feature',
  FEEDBACK = 'feedback',
  SUPPORT = 'support'
}

export enum FeedbackStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived'
}