import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('admin_verifications')
export class AdminVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  mobileNumber: string;

  @Column({ nullable: true })
  alternatePhone: string;

  @Column()
  idType: string;

  @Column({ nullable: true })
  otherIdType: string;

  @Column()
  idNumber: string;

  @Column('text', { array: true })
  id_documents: string[];

  @Column('boolean', { default: false })
  termsAccepted: boolean;

  @Column()
  hostelProofType: string;

  @Column('text', { array: true })
  hostel_proof_documents: string[];

  // @Column('text', { array: true })
  // hostelProofFiles: string[];

  @Column({ 
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, user => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewed_by?: User;

  @Column({ nullable: true })
  reviewed_by_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date;

  @Column({ nullable: true })
  rejection_reason: string;
}