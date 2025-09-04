// review.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate, Index } from 'typeorm';
import { Hostel } from './hostel.entity';
import { Booking } from './booking.entity';

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged'
}

@Entity('reviews')
@Index(['hostelId', 'studentId'], { unique: true }) // Prevent duplicate reviews per student per hostel
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hostel_id' })
  hostelId: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'student_name', length: 100 })
  studentName: string;

  @Column('int', { name: 'rating' })
  rating: number; // 1-5 stars

  @Column('text', { name: 'review_text' })
  reviewText: string;

  // Detailed ratings breakdown
  @Column('jsonb', { default: {}, name: 'detailed_ratings' })
  detailedRatings: {
    cleanliness?: number;
    security?: number;
    location?: number;
    staff?: number;
    facilities?: number;
    valueForMoney?: number;
  };

  // Review metadata
  @Column('enum', { enum: ReviewStatus, default: ReviewStatus.APPROVED })
  status: ReviewStatus;

  @Column('jsonb', { default: [], name: 'helpful_votes' })
  helpfulVotes: string[]; // Array of user IDs who found this helpful

  @Column({ default: 0, name: 'helpful_count' })
  helpfulCount: number;

  @Column('jsonb', { default: [], name: 'images' })
  images: string[]; // Review images URLs

  // Admin moderation
  @Column('text', { nullable: true, name: 'admin_notes' })
  adminNotes: string;

  @Column({ nullable: true, name: 'moderated_by' })
  moderatedBy: string;

  @Column('timestamptz', { nullable: true, name: 'moderated_at' })
  moderatedAt: Date;

  // Response from hostel
  @Column('text', { nullable: true, name: 'hostel_response' })
  hostelResponse: string;

  @Column('timestamptz', { nullable: true, name: 'hostel_responded_at' })
  hostelRespondedAt: Date;

  // Timestamps
  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Hostel)
  @JoinColumn({ name: 'hostel_id' })
  hostel: Hostel;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @BeforeInsert()
  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
    
    // Validate rating
    if (this.rating < 1 || this.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    // Validate detailed ratings
    if (this.detailedRatings) {
      Object.values(this.detailedRatings).forEach(rating => {
        if (rating !== undefined && (rating < 1 || rating > 5)) {
          throw new Error('All detailed ratings must be between 1 and 5');
        }
      });
    }
  }

  // Helper methods
  getOverallRating(): number {
    return this.rating;
  }

  getAverageDetailedRating(): number {
    if (!this.detailedRatings) return this.rating;
    
    const ratings = Object.values(this.detailedRatings).filter(r => r !== undefined);
    if (ratings.length === 0) return this.rating;
    
    return ratings.reduce((sum, rating) => sum + rating!, 0) / ratings.length;
  }

  isHelpfulToUser(userId: string): boolean {
    return this.helpfulVotes.includes(userId);
  }

  canBeEditedBy(userId: string): boolean {
    return this.studentId === userId && this.status === ReviewStatus.PENDING;
  }

  canBeDeletedBy(userId: string, isAdmin: boolean = false): boolean {
    return this.studentId === userId || isAdmin;
  }

  isVisible(): boolean {
    return this.status === ReviewStatus.APPROVED;
  }

  getTimeAgo(): string {
    const now = new Date();
    const diffInMs = now.getTime() - this.createdAt.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  }

  markAsHelpful(userId: string): void {
    if (!this.helpfulVotes.includes(userId)) {
      this.helpfulVotes.push(userId);
      this.helpfulCount = this.helpfulVotes.length;
    }
  }

  removeHelpfulVote(userId: string): void {
    const index = this.helpfulVotes.indexOf(userId);
    if (index > -1) {
      this.helpfulVotes.splice(index, 1);
      this.helpfulCount = this.helpfulVotes.length;
    }
  }

  moderate(status: ReviewStatus, moderatorId: string, notes?: string): void {
    this.status = status;
    this.moderatedBy = moderatorId;
    this.moderatedAt = new Date();
    if (notes) this.adminNotes = notes;
  }

  addHostelResponse(response: string): void {
    this.hostelResponse = response;
    this.hostelRespondedAt = new Date();
  }
}