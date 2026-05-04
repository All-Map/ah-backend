import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  Review,
  ReviewStatus,
  BookingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { 
  IsOptional, 
  IsString, 
  IsNumber, 
  IsEnum, 
  Min, 
  Max, 
  IsUUID,
  IsArray,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'Booking ID' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ description: 'Rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Review text' })
  @IsString()
  reviewText: string;

  @ApiPropertyOptional({ description: 'Detailed ratings' })
  @IsOptional()
  detailedRatings?: {
    cleanliness?: number;
    security?: number;
    location?: number;
    staff?: number;
    facilities?: number;
    valueForMoney?: number;
  };

  @ApiPropertyOptional({ description: 'Review images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ description: 'Rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Review text' })
  @IsOptional()
  @IsString()
  reviewText?: string;

  @ApiPropertyOptional({ description: 'Detailed ratings' })
  @IsOptional()
  detailedRatings?: {
    cleanliness?: number;
    security?: number;
    location?: number;
    staff?: number;
    facilities?: number;
    valueForMoney?: number;
  };

  @ApiPropertyOptional({ description: 'Review images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class ReviewFilterDto {
  @IsOptional()
  @IsUUID()
  hostelId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minRating?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxRating?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(['createdAt', 'rating', 'helpfulCount'])
  sortBy?: 'createdAt' | 'rating' | 'helpfulCount' = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  search?: string;
}

export class HostelResponseDto {
  @ApiProperty({ description: 'Hostel response text' })
  @IsString()
  response: string;
}

export class ModerateReviewDto {
  @ApiProperty({ description: 'New status', enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @ApiPropertyOptional({ description: 'Moderation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

function reviewInclude() {
  return {
    hostel: true,
    booking: { include: { room: true } },
  } as const;
}

type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: ReturnType<typeof reviewInclude> }>;

function canBeEditedBy(review: Review, userId: string): boolean {
  return review.studentId === userId && review.status === ReviewStatus.pending;
}

function canBeDeletedBy(review: Review, userId: string, isAdmin: boolean): boolean {
  return review.studentId === userId || isAdmin;
}

function isHelpfulToUser(review: Review, userId: string): boolean {
  return (review.helpfulVotes as string[]).includes(userId);
}

function markAsHelpfulState(review: Review, userId: string): { helpfulVotes: string[]; helpfulCount: number } {
  const votes = [...(review.helpfulVotes as string[])];
  if (!votes.includes(userId)) {
    votes.push(userId);
  }
  return { helpfulVotes: votes, helpfulCount: votes.length };
}

function removeHelpfulVoteState(review: Review, userId: string): { helpfulVotes: string[]; helpfulCount: number } {
  const votes = (review.helpfulVotes as string[]).filter((id) => id !== userId);
  return { helpfulVotes: votes, helpfulCount: votes.length };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(studentId: string, createReviewDto: CreateReviewDto): Promise<Review> {
    const { bookingId, rating, reviewText, detailedRatings, images } = createReviewDto;

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hostel: true, room: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.studentId !== studentId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    if (booking.status !== BookingStatus.checked_out) {
      throw new BadRequestException('You can only review hostels after checking out');
    }

    const existingReview = await this.prisma.review.findFirst({
      where: { hostelId: booking.hostelId, studentId, bookingId },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this hostel for this booking');
    }

    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (detailedRatings) {
      Object.values(detailedRatings).forEach((r) => {
        if (r !== undefined && (r < 1 || r > 5)) {
          throw new BadRequestException('All detailed ratings must be between 1 and 5');
        }
      });
    }

    const savedReview = await this.prisma.review.create({
      data: {
        hostelId: booking.hostelId,
        bookingId,
        studentId,
        studentName: student.name || student.email,
        rating,
        reviewText,
        detailedRatings: (detailedRatings || {}) as Prisma.InputJsonValue,
        images: (images || []) as Prisma.InputJsonValue,
        status: ReviewStatus.approved,
      },
    });

    this.updateHostelRating(booking.hostelId).catch((error) => {
      console.error('Failed to update hostel rating:', error);
    });

    return savedReview;
  }

  async getReviewByBookingId(bookingId: string): Promise<ReviewWithRelations | null> {
    return this.prisma.review.findFirst({
      where: { bookingId },
      include: reviewInclude(),
    });
  }

  async getReviews(filterDto: ReviewFilterDto) {
    let {
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
      search,
    } = filterDto;

    // Ensure page and limit are numbers (crucial for Prisma skip/take)
    page = Number(page) || 1;
    limit = Number(limit) || 10;

    const where: Prisma.ReviewWhereInput = {};

    if (hostelId) where.hostelId = hostelId;
    if (studentId) where.studentId = studentId;
    if (status !== undefined) {
      where.status = status;
    } else {
      where.status = ReviewStatus.approved;
    }
    if (rating !== undefined) {
      where.rating = rating;
    } else {
      const ratingRange: Prisma.IntFilter = {};
      if (minRating !== undefined) ratingRange.gte = minRating;
      if (maxRating !== undefined) ratingRange.lte = maxRating;
      if (Object.keys(ratingRange).length > 0) {
        where.rating = ratingRange;
      }
    }

    if (search) {
      where.OR = [
        { reviewText: { contains: search, mode: 'insensitive' } },
        { studentName: { contains: search, mode: 'insensitive' } },
        { hostel: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderField = sortBy === 'helpfulCount' ? 'helpfulCount' : sortBy === 'rating' ? 'rating' : 'createdAt';
    const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'asc' : 'desc';

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { hostel: true, booking: true },
        orderBy: { [orderField]: orderDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReviewById(id: string): Promise<ReviewWithRelations> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: reviewInclude(),
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async updateReview(id: string, studentId: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (!canBeEditedBy(review, studentId)) {
      throw new ForbiddenException('You can only edit your own pending reviews');
    }

    if (updateReviewDto.rating && (updateReviewDto.rating < 1 || updateReviewDto.rating > 5)) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    if (updateReviewDto.detailedRatings) {
      Object.values(updateReviewDto.detailedRatings).forEach((r) => {
        if (r !== undefined && (r < 1 || r > 5)) {
          throw new BadRequestException('All detailed ratings must be between 1 and 5');
        }
      });
    }

    const updatedReview = await this.prisma.review.update({
      where: { id },
      data: {
        ...('rating' in updateReviewDto && updateReviewDto.rating !== undefined
          ? { rating: updateReviewDto.rating }
          : {}),
        ...('reviewText' in updateReviewDto && updateReviewDto.reviewText !== undefined
          ? { reviewText: updateReviewDto.reviewText }
          : {}),
        ...(updateReviewDto.detailedRatings
          ? { detailedRatings: updateReviewDto.detailedRatings as Prisma.InputJsonValue }
          : {}),
        ...(updateReviewDto.images ? { images: updateReviewDto.images as Prisma.InputJsonValue } : {}),
        updatedAt: new Date(),
      },
    });

    if (updateReviewDto.rating) {
      this.updateHostelRating(review.hostelId).catch((error) => {
        console.error('Failed to update hostel rating:', error);
      });
    }

    return updatedReview;
  }

  async deleteReview(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (!canBeDeletedBy(review, userId, isAdmin)) {
      throw new ForbiddenException('You do not have permission to delete this review');
    }

    const hostelId = review.hostelId;
    await this.prisma.review.delete({ where: { id } });

    this.updateHostelRating(hostelId).catch((error) => {
      console.error('Failed to update hostel rating:', error);
    });
  }

  async toggleHelpfulVote(reviewId: string, userId: string): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const next = isHelpfulToUser(review, userId)
      ? removeHelpfulVoteState(review, userId)
      : markAsHelpfulState(review, userId);

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        helpfulVotes: next.helpfulVotes,
        helpfulCount: next.helpfulCount,
        updatedAt: new Date(),
      },
    });
  }

  async addHostelResponse(reviewId: string, hostelAdminId: string, responseDto: HostelResponseDto): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const hostel = await this.prisma.hostel.findUnique({ where: { id: review.hostelId } });

    if (!hostel || hostel.adminId !== hostelAdminId) {
      throw new ForbiddenException('You can only respond to reviews of your own hostel');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        hostelResponse: responseDto.response,
        hostelRespondedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async moderateReview(reviewId: string, moderatorId: string, moderateDto: ModerateReviewDto): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: moderateDto.status,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        ...(moderateDto.notes ? { adminNotes: moderateDto.notes } : {}),
        updatedAt: new Date(),
      },
    });

    if (moderateDto.status === ReviewStatus.approved || moderateDto.status === ReviewStatus.rejected) {
      this.updateHostelRating(review.hostelId).catch((error) => {
        console.error('Failed to update hostel rating:', error);
      });
    }

    return updatedReview;
  }

  async getHostelReviews(hostelId: string, filterDto: Partial<ReviewFilterDto> = {}) {
    return this.getReviews({
      ...filterDto,
      hostelId,
      status: filterDto.status || ReviewStatus.approved,
    });
  }

  async getStudentReviews(studentId: string, filterDto: Partial<ReviewFilterDto> = {}) {
    return this.getReviews({
      ...filterDto,
      studentId,
    });
  }

  async getEligibleBookingsForReview(studentId: string) {
    const checkedOutBookings = await this.prisma.booking.findMany({
      where: {
        studentId,
        status: BookingStatus.checked_out,
      },
      include: { hostel: true, room: true },
      orderBy: { checkedOutAt: 'desc' },
    });

    const existingReviews = await this.prisma.review.findMany({
      where: { studentId },
      select: { bookingId: true },
    });

    const reviewedBookingIds = new Set(existingReviews.map((r) => r.bookingId));

    return checkedOutBookings.filter((b) => !reviewedBookingIds.has(b.id));
  }

  async getHostelReviewStats(hostelId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        hostelId,
        status: ReviewStatus.approved,
      },
    });

    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        averageDetailedRatings: {},
        totalHelpfulVotes: 0,
      };
    }

    const totalReviews = reviews.length;
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    const detailedRatingsSum: Record<string, { sum: number; count: number }> = {};
    reviews.forEach((review) => {
      const dr = review.detailedRatings as Record<string, number> | null;
      if (dr) {
        Object.entries(dr).forEach(([key, value]) => {
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
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      averageDetailedRatings,
      totalHelpfulVotes,
    };
  }

  private async updateHostelRating(hostelId: string): Promise<void> {
    const stats = await this.getHostelReviewStats(hostelId);

    await this.prisma.hostel.update({
      where: { id: hostelId },
      data: {
        rating: new Prisma.Decimal(stats.averageRating),
        totalReviews: stats.totalReviews,
      },
    });
  }

  async getRecentReviews(limit: number = 10): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { status: ReviewStatus.approved },
      include: { hostel: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async searchReviews(searchTerm: string, filterDto: ReviewFilterDto = {}) {
    return this.getReviews({
      ...filterDto,
      search: searchTerm,
    });
  }
}
