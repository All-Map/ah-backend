// reviews.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review, ReviewStatus } from '../entities/review.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Hostel } from '../entities/hostel.entity';
import { User } from '../entities/user.entity';

export interface CreateReviewDto {
  bookingId: string;
  rating: number;
  reviewText: string;
  detailedRatings?: {
    cleanliness?: number;
    security?: number;
    location?: number;
    staff?: number;
    facilities?: number;
    valueForMoney?: number;
  };
  images?: string[];
}

export interface UpdateReviewDto {
  rating?: number;
  reviewText?: string;
  detailedRatings?: {
    cleanliness?: number;
    security?: number;
    location?: number;
    staff?: number;
    facilities?: number;
    valueForMoney?: number;
  };
  images?: string[];
}

export interface ReviewFilterDto {
  hostelId?: string;
  studentId?: string;
  status?: ReviewStatus;
  rating?: number;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'rating' | 'helpfulCount';
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
}

export interface HostelResponseDto {
  response: string;
}

export interface ModerateReviewDto {
  status: ReviewStatus;
  notes?: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Hostel)
    private readonly hostelRepository: Repository<Hostel>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new review
   */
  async createReview(studentId: string, createReviewDto: CreateReviewDto): Promise<Review> {
    const { bookingId, rating, reviewText, detailedRatings, images } = createReviewDto;

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Get and validate booking
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['hostel', 'room']
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify booking belongs to the student
    if (booking.studentId !== studentId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    // Check if booking is checked out
    if (booking.status !== BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('You can only review hostels after checking out');
    }

    // Check if review already exists
    const existingReview = await this.reviewRepository.findOne({
      where: {
        hostelId: booking.hostelId,
        studentId,
        bookingId
      }
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this hostel for this booking');
    }

    // Get student info
    const student = await this.userRepository.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Validate detailed ratings if provided
    if (detailedRatings) {
      Object.values(detailedRatings).forEach(rating => {
        if (rating !== undefined && (rating < 1 || rating > 5)) {
          throw new BadRequestException('All detailed ratings must be between 1 and 5');
        }
      });
    }

    // Create review
    const review = this.reviewRepository.create({
      hostelId: booking.hostelId,
      bookingId,
      studentId,
      studentName: student.name || student.email,
      rating,
      reviewText,
      detailedRatings: detailedRatings || {},
      images: images || [],
      status: ReviewStatus.APPROVED // Reviews need approval by default
    });

    const savedReview = await this.reviewRepository.save(review);

    // Update hostel rating asynchronously
    this.updateHostelRating(booking.hostelId).catch(error => {
      console.error('Failed to update hostel rating:', error);
    });

    return savedReview;
  }

  async getReviewByBookingId(bookingId: string): Promise<Review | null> {
    const review = await this.reviewRepository.findOne({
      where: { bookingId },
      relations: ['hostel', 'booking', 'booking.room']
    });

    return review || null;
  }

  /**
   * Get reviews with filtering
   */
  async getReviews(filterDto: ReviewFilterDto) {
    const {
      hostelId,
      studentId,
      status,
      rating,
      minRating,
      maxRating,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search
    } = filterDto;

    const queryBuilder = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.hostel', 'hostel')
      .leftJoinAndSelect('review.booking', 'booking');

    // Apply filters
    if (hostelId) {
      queryBuilder.andWhere('review.hostelId = :hostelId', { hostelId });
    }

    if (studentId) {
      queryBuilder.andWhere('review.studentId = :studentId', { studentId });
    }

    if (status) {
      queryBuilder.andWhere('review.status = :status', { status });
    } else {
      // Default to showing only approved reviews for public viewing
      queryBuilder.andWhere('review.status = :status', { status: ReviewStatus.APPROVED });
    }

    if (rating) {
      queryBuilder.andWhere('review.rating = :rating', { rating });
    }

    if (minRating) {
      queryBuilder.andWhere('review.rating >= :minRating', { minRating });
    }

    if (maxRating) {
      queryBuilder.andWhere('review.rating <= :maxRating', { maxRating });
    }

    if (search) {
      queryBuilder.andWhere(
        '(review.reviewText ILIKE :search OR review.studentName ILIKE :search OR hostel.name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`review.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [reviews, total] = await queryBuilder.getManyAndCount();

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a specific review by ID
   */
  async getReviewById(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['hostel', 'booking', 'booking.room']
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  /**
   * Update a review (only by the original reviewer and only if pending)
   */
  async updateReview(id: string, studentId: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const review = await this.getReviewById(id);

    // Check if student can edit this review
    if (!review.canBeEditedBy(studentId)) {
      throw new ForbiddenException('You can only edit your own pending reviews');
    }

    // Validate rating if provided
    if (updateReviewDto.rating && (updateReviewDto.rating < 1 || updateReviewDto.rating > 5)) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Validate detailed ratings if provided
    if (updateReviewDto.detailedRatings) {
      Object.values(updateReviewDto.detailedRatings).forEach(rating => {
        if (rating !== undefined && (rating < 1 || rating > 5)) {
          throw new BadRequestException('All detailed ratings must be between 1 and 5');
        }
      });
    }

    // Update review
    Object.assign(review, updateReviewDto);
    const updatedReview = await this.reviewRepository.save(review);

    // Update hostel rating if rating changed
    if (updateReviewDto.rating) {
      this.updateHostelRating(review.hostelId).catch(error => {
        console.error('Failed to update hostel rating:', error);
      });
    }

    return updatedReview;
  }

  /**
   * Delete a review
   */
  async deleteReview(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const review = await this.getReviewById(id);

    if (!review.canBeDeletedBy(userId, isAdmin)) {
      throw new ForbiddenException('You do not have permission to delete this review');
    }

    const hostelId = review.hostelId;
    await this.reviewRepository.remove(review);

    // Update hostel rating
    this.updateHostelRating(hostelId).catch(error => {
      console.error('Failed to update hostel rating:', error);
    });
  }

  /**
   * Toggle helpful vote on a review
   */
  async toggleHelpfulVote(reviewId: string, userId: string): Promise<Review> {
    const review = await this.getReviewById(reviewId);

    if (review.isHelpfulToUser(userId)) {
      review.removeHelpfulVote(userId);
    } else {
      review.markAsHelpful(userId);
    }

    return await this.reviewRepository.save(review);
  }

  /**
   * Add hostel response to a review
   */
  async addHostelResponse(reviewId: string, hostelAdminId: string, responseDto: HostelResponseDto): Promise<Review> {
    const review = await this.getReviewById(reviewId);

    // Verify that the user is admin of this hostel
    const hostel = await this.hostelRepository.findOne({
      where: { id: review.hostelId }
    });

    if (!hostel || hostel.adminId !== hostelAdminId) {
      throw new ForbiddenException('You can only respond to reviews of your own hostel');
    }

    review.addHostelResponse(responseDto.response);
    return await this.reviewRepository.save(review);
  }

  /**
   * Moderate a review (admin only)
   */
  async moderateReview(reviewId: string, moderatorId: string, moderateDto: ModerateReviewDto): Promise<Review> {
    const review = await this.getReviewById(reviewId);

    review.moderate(moderateDto.status, moderatorId, moderateDto.notes);
    const updatedReview = await this.reviewRepository.save(review);

    // Update hostel rating if review was approved or rejected
    if (moderateDto.status === ReviewStatus.APPROVED || moderateDto.status === ReviewStatus.REJECTED) {
      this.updateHostelRating(review.hostelId).catch(error => {
        console.error('Failed to update hostel rating:', error);
      });
    }

    return updatedReview;
  }

  /**
   * Get reviews for a specific hostel
   */
async getHostelReviews(hostelId: string, filterDto: Partial<ReviewFilterDto> = {}) {
  console.log('🔧 Service - getHostelReviews called:', { hostelId, filterDto });
  
  const result = await this.getReviews({
    ...filterDto,
    hostelId,
    status: filterDto.status || ReviewStatus.APPROVED // This might be the issue!
  });
  
  console.log('🔧 Service - getReviews result:', {
    reviewCount: result.reviews?.length || 0,
    total: result.pagination?.total || 0,
    appliedStatus: filterDto.status || ReviewStatus.APPROVED
  });
  
  return result;
}

  /**
   * Get reviews by a specific student
   */
  async getStudentReviews(studentId: string, filterDto: Partial<ReviewFilterDto> = {}) {
    return this.getReviews({
      ...filterDto,
      studentId
    });
  }

  /**
   * Get booking eligible for review by student
   */
  async getEligibleBookingsForReview(studentId: string): Promise<Booking[]> {
    // Get all checked out bookings for the student
    const checkedOutBookings = await this.bookingRepository.find({
      where: {
        studentId,
        status: BookingStatus.CHECKED_OUT
      },
      relations: ['hostel', 'room'],
      order: { checkedOutAt: 'DESC' }
    });

    // Get existing reviews to filter out already reviewed bookings
    const existingReviews = await this.reviewRepository.find({
      where: { studentId },
      select: ['bookingId']
    });

    const reviewedBookingIds = new Set(existingReviews.map(r => r.bookingId));

    // Filter out bookings that already have reviews
    return checkedOutBookings.filter(booking => !reviewedBookingIds.has(booking.id));
  }

  /**
   * Get review statistics for a hostel
   */
  async getHostelReviewStats(hostelId: string) {
    const reviews = await this.reviewRepository.find({
      where: {
        hostelId,
        status: ReviewStatus.APPROVED
      }
    });

    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        averageDetailedRatings: {},
        totalHelpfulVotes: 0
      };
    }

    const totalReviews = reviews.length;
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    // Rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    // Average detailed ratings
    const detailedRatingsSum: Record<string, { sum: number; count: number }> = {};
    reviews.forEach(review => {
      if (review.detailedRatings) {
        Object.entries(review.detailedRatings).forEach(([key, value]) => {
          if (value !== undefined) {
            if (!detailedRatingsSum[key]) {
              detailedRatingsSum[key] = { sum: 0, count: 0 };
            }
            detailedRatingsSum[key].sum += value;
            detailedRatingsSum[key].count++;
          }
        });
      }
    });

    const averageDetailedRatings: Record<string, number> = {};
    Object.entries(detailedRatingsSum).forEach(([key, { sum, count }]) => {
      averageDetailedRatings[key] = sum / count;
    });

    const totalHelpfulVotes = reviews.reduce((sum, r) => sum + r.helpfulCount, 0);

    return {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingDistribution,
      averageDetailedRatings,
      totalHelpfulVotes
    };
  }

  /**
   * Update hostel rating based on approved reviews
   */
  private async updateHostelRating(hostelId: string): Promise<void> {
    const stats = await this.getHostelReviewStats(hostelId);
    
    const hostel = await this.hostelRepository.findOne({
      where: { id: hostelId }
    });

    if (hostel) {
      hostel.rating = stats.averageRating;
      hostel.total_reviews = stats.totalReviews;
      await this.hostelRepository.save(hostel);
    }
  }

  /**
   * Get recent reviews (for dashboard/homepage)
   */
  async getRecentReviews(limit: number = 10): Promise<Review[]> {
    return await this.reviewRepository.find({
      where: { status: ReviewStatus.APPROVED },
      relations: ['hostel'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  /**
   * Search reviews
   */
  async searchReviews(searchTerm: string, filterDto: ReviewFilterDto = {}) {
    return this.getReviews({
      ...filterDto,
      search: searchTerm
    });
  }
}