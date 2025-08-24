// reviews.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ReviewsService, CreateReviewDto, UpdateReviewDto, ReviewFilterDto, HostelResponseDto, ModerateReviewDto } from './review.service';
import { Review, ReviewStatus } from '../entities/review.entity';
import { File as MulterFile } from 'multer';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Review created successfully',
    type: Review 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid review data or booking not eligible for review' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Cannot review booking that does not belong to user' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Review already exists for this booking' 
  })
  async createReview(
    @Request() req: any,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<Review> {
    const studentId = req.user.id;
    return this.reviewsService.createReview(studentId, createReviewDto);
  }
  

  @Get()
  @ApiOperation({ summary: 'Get reviews with filtering and pagination' })
  @ApiQuery({ name: 'hostelId', required: false, description: 'Filter by hostel ID' })
  @ApiQuery({ name: 'studentId', required: false, description: 'Filter by student ID' })
  @ApiQuery({ name: 'status', required: false, enum: ReviewStatus, description: 'Filter by review status' })
  @ApiQuery({ name: 'rating', required: false, description: 'Filter by exact rating' })
  @ApiQuery({ name: 'minRating', required: false, description: 'Filter by minimum rating' })
  @ApiQuery({ name: 'maxRating', required: false, description: 'Filter by maximum rating' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'rating', 'helpfulCount'], description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reviews retrieved successfully' 
  })
  async getReviews(@Query() filterDto: ReviewFilterDto) {
    return this.reviewsService.getReviews(filterDto);
  }
  
//   @Get('booking/:bookingId')
// @ApiOperation({ summary: 'Get review for a specific booking' })
// @ApiParam({ name: 'bookingId', description: 'Booking ID' })
// @ApiResponse({ 
//   status: HttpStatus.OK, 
//   description: 'Booking review retrieved successfully',
//   type: Review 
// })
// @ApiResponse({ 
//   status: HttpStatus.NOT_FOUND, 
//   description: 'Review not found for this booking' 
// })
// async getBookingReview(@Param('bookingId', ParseUUIDPipe) bookingId: string): Promise<Review | null> {
//   try {
//     // Look for review by bookingId, not by review ID
//     const review = await this.reviewsService.getReviewByBookingId(bookingId);
//     return review;
//   } catch (error) {
//     if (error instanceof NotFoundException) {
//       return null; // Return null instead of throwing for non-existent reviews
//     }
//     throw error;
//   }
// }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent approved reviews' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of reviews to return (default: 10)' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Recent reviews retrieved successfully',
    type: [Review] 
  })
  async getRecentReviews(@Query('limit') limit?: number): Promise<Review[]> {
    return this.reviewsService.getRecentReviews(limit);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search reviews' })
  @ApiQuery({ name: 'search', required: true, description: 'Search term' })
  @ApiQuery({ name: 'hostelId', required: false, description: 'Filter by hostel ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Search results retrieved successfully' 
  })
  async searchReviews(
    @Query('search') searchTerm: string,
    @Query() filterDto: Omit<ReviewFilterDto, 'search'>,
  ) {
    if (!searchTerm?.trim()) {
      throw new BadRequestException('Search term is required');
    }
    return this.reviewsService.searchReviews(searchTerm, filterDto);
  }

  @Get('eligible-bookings/:studentId')
  @ApiOperation({ summary: 'Get bookings eligible for review by student' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Eligible bookings retrieved successfully' 
  })
  async getEligibleBookingsForReview(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Request() req: any,
  ) {
    // Students can only get their own eligible bookings
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.id !== studentId) {
      throw new ForbiddenException('You can only view your own eligible bookings');
    }

    const eligibleBookings = await this.reviewsService.getEligibleBookingsForReview(studentId);
    return { bookingIds: eligibleBookings.map(booking => booking.id) };
  }

  @Get('can-review/:bookingId')
  @ApiOperation({ summary: 'Check if a booking can be reviewed' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiQuery({ name: 'studentId', required: true, description: 'Student ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Review eligibility checked successfully' 
  })
  async canReviewBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
    @Request() req: any,
  ): Promise<{ canReview: boolean }> {
    // Students can only check their own bookings
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.id !== studentId) {
      throw new ForbiddenException('You can only check your own bookings');
    }

    try {
      const eligibleBookings = await this.reviewsService.getEligibleBookingsForReview(studentId);
      const canReview = eligibleBookings.some(booking => booking.id === bookingId);
      return { canReview };
    } catch (error) {
      return { canReview: false };
    }
  }

  @Get('hostel/:hostelId')
  @ApiOperation({ summary: 'Get reviews for a specific hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'rating', 'helpfulCount'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'minRating', required: false, description: 'Minimum rating filter' })
  @ApiQuery({ name: 'maxRating', required: false, description: 'Maximum rating filter' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Hostel reviews retrieved successfully' 
  })
  async getHostelReviews(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query() filterDto: Partial<ReviewFilterDto>,
  ) {
    return this.reviewsService.getHostelReviews(hostelId, filterDto);
  }

  @Get('hostel/:hostelId/stats')
  @ApiOperation({ summary: 'Get review statistics for a hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Review statistics retrieved successfully' 
  })
  async getHostelReviewStats(@Param('hostelId', ParseUUIDPipe) hostelId: string) {
    return this.reviewsService.getHostelReviewStats(hostelId);
  }

  // Add this method to your ReviewsController class

  @Post(':id/moderate')
  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Moderate a review (admin only)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Review moderated successfully',
    type: Review 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Only admins can moderate reviews' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Review not found' 
  })
  async moderateReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() moderateDto: ModerateReviewDto,
    @Request() req: any,
  ): Promise<Review> {
    const moderatorId = req.user.id;
    return this.reviewsService.moderateReview(reviewId, moderatorId, moderateDto);
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Get reviews by a specific student' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'rating'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Student reviews retrieved successfully' 
  })
  async getStudentReviews(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() filterDto: Partial<ReviewFilterDto>,
    @Request() req: any,
  ) {
    // Students can only view their own reviews, admins can view any
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.id !== studentId) {
      throw new ForbiddenException('You can only view your own reviews');
    }

    return this.reviewsService.getStudentReviews(studentId, filterDto);
  }

//   @Get('booking/:bookingId')
//   @ApiOperation({ summary: 'Get review for a specific booking' })
//   @ApiParam({ name: 'bookingId', description: 'Booking ID' })
//   @ApiResponse({ 
//     status: HttpStatus.OK, 
//     description: 'Booking review retrieved successfully',
//     type: Review 
//   })
//   @ApiResponse({ 
//     status: HttpStatus.NOT_FOUND, 
//     description: 'Review not found for this booking' 
//   })
//   async getBookingReview(@Param('bookingId', ParseUUIDPipe) bookingId: string): Promise<Review> {
//     return this.reviewsService.getReviewById(bookingId);
//   }

  @Get('booking/:bookingId')
@ApiOperation({ summary: 'Get review for a specific booking' })
@ApiParam({ name: 'bookingId', description: 'Booking ID' })
@ApiResponse({ 
  status: HttpStatus.OK, 
  description: 'Booking review retrieved successfully',
  type: Review 
})
@ApiResponse({ 
  status: HttpStatus.NOT_FOUND, 
  description: 'Review not found for this booking' 
})
async getBookingReview(@Param('bookingId', ParseUUIDPipe) bookingId: string): Promise<{ review: Review | null }> {
  try {
    const review = await this.reviewsService.getReviewByBookingId(bookingId);
    return { review };
  } catch (error) {
    if (error instanceof NotFoundException) {
      return { review: null }; // Return proper JSON response instead of null
    }
    throw error;
  }
}

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific review by ID' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Review retrieved successfully',
    type: Review 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Review not found' 
  })
  async getReviewById(@Param('id', ParseUUIDPipe) id: string): Promise<Review> {
    return this.reviewsService.getReviewById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a review (only by original reviewer and only if pending)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Review updated successfully',
    type: Review 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Cannot edit this review' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Review not found' 
  })
  async updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<Review> {
    const studentId = req.user.id;
    return this.reviewsService.updateReview(id, studentId, updateReviewDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Review deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Cannot delete this review' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Review not found' 
  })
  async deleteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user.id;
    const isAdmin = req.user.role === UserRole.SUPER_ADMIN;
    return this.reviewsService.deleteReview(id, userId, isAdmin);
  }

  @Post(':id/helpful')
  @ApiOperation({ summary: 'Toggle helpful vote on a review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Helpful vote toggled successfully',
    type: Review 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Review not found' 
  })
  async toggleHelpfulVote(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Request() req: any,
  ): Promise<Review> {
    const userId = req.user.id;
    return this.reviewsService.toggleHelpfulVote(reviewId, userId);
  }

  @Post(':id/response')
//   @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add hostel response to a review (hostel admin only)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Hostel response added successfully',
    type: Review 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Cannot respond to reviews of other hostels' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Review not found' 
  })
  async addHostelResponse(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() hostelResponseDto: HostelResponseDto,
    @Request() req: any,
  ): Promise<Review> {
    const userId = req.user.id;
    return this.reviewsService.addHostelResponse(reviewId, userId, hostelResponseDto);
  }
}