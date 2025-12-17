import { Controller, Post, Body, UseGuards, Get, Query, Param, Patch, Req, Ip } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeedbackService } from './feedback.service';
import { FeedbackStatus, FeedbackCategory } from '../entities/feedback.entity';
import { PublicFeedbackStatus, PublicFeedbackCategory } from '../entities/public-feedback.entity';

export class PublicFeedbackDto {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: PublicFeedbackCategory;
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}


  @Post('public')
  async submitPublicFeedback(
    @Body() feedbackDto: PublicFeedbackDto,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    try {
      const userAgent = req.headers['user-agent'];
      const result = await this.feedbackService.submitPublicFeedback(
        feedbackDto.name,
        feedbackDto.email,
        feedbackDto.subject,
        feedbackDto.message,
        feedbackDto.category || PublicFeedbackCategory.GENERAL,
        ip,
        userAgent
      );

      return {
        success: true,
        message: 'Thank you for your feedback! We\'ll review it shortly.',
        data: result,
      };
    } catch (error) {
      console.error('Public feedback error:', error);
      throw error;
    }
  }

  // ================ AUTHENTICATED USER ENDPOINTS ================

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submitFeedback(
    @CurrentUser() user: User,
    @Body() feedbackDto: { subject: string; message: string; category: string }
  ) {
    try {
      const { data, error } = await this.feedbackService['supabase'].client
        .from('feedback')
        .insert([
          {
            user_id: user.id,
            subject: feedbackDto.subject,
            message: feedbackDto.message,
            category: feedbackDto.category || 'general',
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Feedback submission error:', error);
        throw new Error('Failed to submit feedback');
      }

      return {
        success: true,
        message: 'Feedback submitted successfully',
        data
      };
    } catch (error) {
      console.error('Feedback error:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-feedback')
  async getMyFeedback(@CurrentUser() user: User) {
    try {
      const { data, error } = await this.feedbackService['supabase'].client
        .from('feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch feedback error:', error);
        throw new Error('Failed to fetch feedback');
      }

      return data;
    } catch (error) {
      console.error('Get feedback error:', error);
      throw error;
    }
  }

  // ================ SUPER ADMIN ENDPOINTS ================

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/all')
  async getAllFeedback(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: FeedbackStatus,
    @Query('category') category?: FeedbackCategory | string,
    @Query('search') search?: string,
  ) {
    try {
      const result = await this.feedbackService.getAllFeedback(
        Number(page),
        Number(limit),
        status,
        category,
        search
      );
      return result;
    } catch (error) {
      console.error('Get all feedback error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/:id/status')
  async updateFeedbackStatus(
    @Param('id') feedbackId: string,
    @Body() updateDto: { status: FeedbackStatus; adminNotes?: string }
  ) {
    try {
      const updatedFeedback = await this.feedbackService.updateFeedbackStatus(
        feedbackId,
        updateDto.status,
        updateDto.adminNotes
      );
      
      return {
        success: true,
        message: 'Feedback status updated successfully',
        data: updatedFeedback,
      };
    } catch (error) {
      console.error('Update feedback status error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/stats')
  async getFeedbackStats() {
    try {
      const stats = await this.feedbackService.getFeedbackStats();
      return stats;
    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }

  // ================ PUBLIC FEEDBACK ADMIN ENDPOINTS ================

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/public/all')
  async getAllPublicFeedback(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: PublicFeedbackStatus | string,
    @Query('category') category?: PublicFeedbackCategory | string,
    @Query('search') search?: string,
    @Query('includeUserInfo') includeUserInfo: boolean = false,
  ) {
    try {
      const result = await this.feedbackService.getAllPublicFeedback(
        Number(page),
        Number(limit),
        status,
        category,
        search,
        includeUserInfo
      );
      return result;
    } catch (error) {
      console.error('Get all public feedback error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/public/:id')
  async getPublicFeedbackById(@Param('id') feedbackId: string) {
    try {
      const feedback = await this.feedbackService.getPublicFeedbackById(feedbackId);
      return {
        success: true,
        data: feedback,
      };
    } catch (error) {
      console.error('Get public feedback by id error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/public/:id/status')
  async updatePublicFeedbackStatus(
    @Param('id') feedbackId: string,
    @Body() updateDto: { status: PublicFeedbackStatus; adminNotes?: string }
  ) {
    try {
      const updatedFeedback = await this.feedbackService.updatePublicFeedbackStatus(
        feedbackId,
        updateDto.status,
        updateDto.adminNotes
      );
      
      return {
        success: true,
        message: 'Public feedback status updated successfully',
        data: updatedFeedback,
      };
    } catch (error) {
      console.error('Update public feedback status error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/public/stats')
  async getPublicFeedbackStats() {
    try {
      const stats = await this.feedbackService.getPublicFeedbackStats();
      return stats;
    } catch (error) {
      console.error('Get public feedback stats error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/public/email/:email')
  async getPublicFeedbackByEmail(@Param('email') email: string) {
    try {
      const feedbacks = await this.feedbackService.getPublicFeedbackByEmail(email);
      return {
        success: true,
        data: feedbacks,
      };
    } catch (error) {
      console.error('Get public feedback by email error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/public/:id/spam')
  async markPublicFeedbackAsSpam(
    @Param('id') feedbackId: string,
    @Body() spamDto: { reason?: string }
  ) {
    try {
      const feedback = await this.feedbackService.markPublicFeedbackAsSpam(
        feedbackId,
        spamDto.reason
      );
      
      return {
        success: true,
        message: 'Feedback marked as spam',
        data: feedback,
      };
    } catch (error) {
      console.error('Mark as spam error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/public/:id/note')
  async addAdminNoteToPublicFeedback(
    @Param('id') feedbackId: string,
    @Body() noteDto: { note: string },
    @CurrentUser() user: User
  ) {
    try {
      const feedback = await this.feedbackService.addAdminNoteToPublicFeedback(
        feedbackId,
        noteDto.note,
        user.id
      );
      
      return {
        success: true,
        message: 'Admin note added successfully',
        data: feedback,
      };
    } catch (error) {
      console.error('Add admin note error:', error);
      throw error;
    }
  }

  @Roles('super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/combined-stats')
  async getCombinedFeedbackStats() {
    try {
      const stats = await this.feedbackService.getCombinedFeedbackStats();
      return stats;
    } catch (error) {
      console.error('Get combined stats error:', error);
      throw error;
    }
  }
}