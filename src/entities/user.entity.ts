import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert, ManyToMany } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminVerification } from './admin-verification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ 
    type: 'enum',
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    nullable: true 
  })
  gender: string;

  @Column()
  password_hash: string;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ nullable: true })
  verification_token: string;

  @Column({ nullable: true })
  password_reset_token: string;

  @Column({ type: 'timestamp', nullable: true })
  reset_token_expiry: Date;

  @Column({type: 'timestamptz', nullable: true})
  verification_token_expires_at: Date;

  @Column({type: 'date', nullable: true})
  verified_at: Date;

  @Column({type: 'enum', enum: ['unverified', 'pending', 'verified'], default: 'unverified'})
  status: string;

  @Column({ 
    type: 'enum',
    enum: ['student', 'hostel_admin', 'super_admin'],
    default: 'student'
  })
  role: string;

  @Column({ default: false })
  terms_accepted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  terms_accepted_at: Date;

  @Column({ nullable: true })
  school_id: string;

  @BeforeInsert()
  async hashPassword() {
    if (this.password_hash) {
      this.password_hash = await bcrypt.hash(this.password_hash, 10);
    }
  }

  async comparePassword(attempt: string): Promise<boolean> {
    return bcrypt.compare(attempt, this.password_hash);
  }

@ManyToMany(() => AdminVerification, verification => verification.user)
verification_requests: AdminVerification[];
  
}

export enum UserRole {
  STUDENT = 'student',
  HOSTEL_ADMIN = 'hostel_admin',
  SUPER_ADMIN = 'super_admin',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}