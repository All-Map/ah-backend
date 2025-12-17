import { Injectable, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Feedback, FeedbackStatus, FeedbackCategory } from '../entities/feedback.entity';
import { 
  PublicFeedback, 
  PublicFeedbackStatus, 
  PublicFeedbackCategory,
  PublicFeedbackStats 
} from '../entities/public-feedback.entity';

export interface FeedbackWithUser {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
}

export interface PublicFeedbackWithStats extends PublicFeedback {
  isExistingUser?: boolean;
  userInfo?: {
    id?: string;
    name?: string;
    role?: string;
  };
}

@Injectable()
export class FeedbackService {
  constructor(private readonly supabase: SupabaseService) {}

  // ================ AUTHENTICATED USER FEEDBACK METHODS ================

  async getAllFeedback(
    page: number = 1,
    limit: number = 20,
    status?: FeedbackStatus,
    category?: FeedbackCategory | string,
    search?: string
  ): Promise<{
    data: FeedbackWithUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      // Build the query
      let query = this.supabase.client
        .from('feedback')
        .select(`
          *,
          user:users(id, name, email, phone, role)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.or(`subject.ilike.%${search}%,message.ilike.%${search}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error('Get all feedback error:', error);
        throw new Error('Failed to fetch feedback');
      }

      const total = count || 0;
      
      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Feedback service error:', error);
      throw error;
    }
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    adminNotes?: string
  ): Promise<Feedback> {
    try {
      const { data, error } = await this.supabase.client
        .from('feedback')
        .update({
          status,
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId)
        .select('*')
        .single();

      if (error) {
        console.error('Update feedback error:', error);
        throw new Error('Failed to update feedback status');
      }

      return data;
    } catch (error) {
      console.error('Update service error:', error);
      throw error;
    }
  }

  async getFeedbackStats(): Promise<{
    total: number;
    pending: number;
    reviewed: number;
    resolved: number;
    byCategory: Record<string, number>;
  }> {
    try {
      // Get counts by status
      const { data: statusCounts, error: statusError } = await this.supabase.client
        .from('feedback')
        .select('status', { count: 'exact' });

      if (statusError) throw statusError;

      // Get counts by category
      const { data: categoryCounts, error: categoryError } = await this.supabase.client
        .rpc('get_feedback_category_counts');

      if (categoryError) {
        // Fallback if function doesn't exist
        const { data: fallback } = await this.supabase.client
          .from('feedback')
          .select('category')
          .order('category');

        const byCategory = (fallback || []).reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const total = statusCounts?.length || 0;
        const pending = statusCounts?.filter(s => s.status === 'pending').length || 0;
        const reviewed = statusCounts?.filter(s => s.status === 'reviewed').length || 0;
        const resolved = statusCounts?.filter(s => s.status === 'resolved').length || 0;

        return {
          total,
          pending,
          reviewed,
          resolved,
          byCategory,
        };
      }

      const total = statusCounts?.length || 0;
      const pending = statusCounts?.filter(s => s.status === 'pending').length || 0;
      const reviewed = statusCounts?.filter(s => s.status === 'reviewed').length || 0;
      const resolved = statusCounts?.filter(s => s.status === 'resolved').length || 0;

      return {
        total,
        pending,
        reviewed,
        resolved,
        byCategory: categoryCounts || {},
      };
    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }

  // ================ PUBLIC FEEDBACK METHODS ================

  async submitPublicFeedback(
    name: string,
    email: string,
    subject: string,
    message: string,
    category: PublicFeedbackCategory = PublicFeedbackCategory.GENERAL,
    ipAddress?: string,
    userAgent?: string
  ): Promise<PublicFeedback> {
    try {
      // Check if this email belongs to an existing user
      const { data: existingUser } = await this.supabase.client
        .from('users')
        .select('id, name, role')
        .eq('email', email)
        .single();

      const feedbackData: any = {
        name,
        email,
        subject,
        message,
        category,
        status: PublicFeedbackStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(ipAddress && { ip_address: ipAddress }),
        ...(userAgent && { user_agent: userAgent }),
        ...(existingUser && { user_id: existingUser.id })
      };

      const { data, error } = await this.supabase.client
        .from('public_feedback')
        .insert([feedbackData])
        .select('*')
        .single();

      if (error) {
        console.error('Submit public feedback error:', error);
        throw new Error('Failed to submit public feedback');
      }

      // Create PublicFeedback entity instance
      const publicFeedback = new PublicFeedback();
      Object.assign(publicFeedback, data);
      
      if (existingUser) {
        publicFeedback['isExistingUser'] = true;
        publicFeedback['userInfo'] = existingUser;
      }

      return publicFeedback;
    } catch (error) {
      console.error('Submit public feedback service error:', error);
      throw error;
    }
  }

  async getAllPublicFeedback(
    page: number = 1,
    limit: number = 20,
    status?: PublicFeedbackStatus | string,
    category?: PublicFeedbackCategory | string,
    search?: string,
    includeUserInfo: boolean = false
  ): Promise<{
    data: PublicFeedbackWithStats[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      let query = this.supabase.client
        .from('public_feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.or(`
          subject.ilike.%${search}%,
          message.ilike.%${search}%,
          name.ilike.%${search}%,
          email.ilike.%${search}%
        `);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error('Get all public feedback error:', error);
        throw new Error('Failed to fetch public feedback');
      }

      const feedbacks: PublicFeedbackWithStats[] = [];

      // Convert to PublicFeedback entities and check for existing users
      if (data && includeUserInfo) {
        for (const item of data) {
          const feedback = new PublicFeedback();
          Object.assign(feedback, item);

          // Check if email belongs to an existing user
          if (item.email) {
            const { data: userData } = await this.supabase.client
              .from('users')
              .select('id, name, role')
              .eq('email', item.email)
              .single();

            (feedback as any).isExistingUser = !!userData;
            (feedback as any).userInfo = userData || undefined;
            feedbacks.push(feedback as PublicFeedbackWithStats);
          } else {
            feedbacks.push(feedback as PublicFeedbackWithStats);
          }
        }
      } else if (data) {
        feedbacks.push(...data.map(item => {
          const feedback = new PublicFeedback();
          Object.assign(feedback, item);
          return feedback as PublicFeedbackWithStats;
        }));
      }

      const total = count || 0;
      
      return {
        data: feedbacks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Public feedback service error:', error);
      throw error;
    }
  }

  async getPublicFeedbackById(id: string): Promise<PublicFeedbackWithStats> {
    try {
      const { data, error } = await this.supabase.client
        .from('public_feedback')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Get public feedback by id error:', error);
        throw new Error('Public feedback not found');
      }

      const feedback = new PublicFeedback();
      Object.assign(feedback, data);

      // Check if email belongs to an existing user
      let userInfo: { id: any; name: any; role: any; } | null = null;
      if (data.email) {
        const { data: userData } = await this.supabase.client
          .from('users')
          .select('id, name, role')
          .eq('email', data.email)
          .single();
        
        userInfo = userData;
      }

      (feedback as any).isExistingUser = !!userInfo;
      (feedback as any).userInfo = userInfo || undefined;
      return feedback as PublicFeedbackWithStats;
    } catch (error) {
      console.error('Get public feedback by id service error:', error);
      throw error;
    }
  }

  async updatePublicFeedbackStatus(
    feedbackId: string,
    status: PublicFeedbackStatus,
    adminNotes?: string
  ): Promise<PublicFeedback> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes;
      }

      // If status is resolved or reviewed, mark as responded
      if (status === PublicFeedbackStatus.RESOLVED || status === PublicFeedbackStatus.REVIEWED) {
        updateData.responded = true;
        updateData.responded_at = new Date().toISOString();
      }

      const { data, error } = await this.supabase.client
        .from('public_feedback')
        .update(updateData)
        .eq('id', feedbackId)
        .select('*')
        .single();

      if (error) {
        console.error('Update public feedback error:', error);
        throw new Error('Failed to update public feedback status');
      }

      const feedback = new PublicFeedback();
      Object.assign(feedback, data);
      return feedback;
    } catch (error) {
      console.error('Update public feedback service error:', error);
      throw error;
    }
  }

  async getPublicFeedbackStats(): Promise<PublicFeedbackStats> {
    try {
      // Try to use the view first
      const { data: statsView, error: viewError } = await this.supabase.client
        .from('public_feedback_stats')
        .select('*')
        .single();

      if (!viewError && statsView) {
        return {
          total: statsView.total || 0,
          pending: statsView.pending || 0,
          reviewed: statsView.reviewed || 0,
          resolved: statsView.resolved || 0,
          archived: statsView.archived || 0,
          byCategory: {},
          today: statsView.today || 0,
          thisWeek: statsView.this_week || 0,
          thisMonth: statsView.this_month || 0,
          responded: statsView.responded || 0,
          avgResponseTime: statsView.avg_response_hours || 0,
        };
      }

      // Fallback to manual calculation
      const { data: allFeedback, error } = await this.supabase.client
        .from('public_feedback')
        .select('*');

      if (error) throw error;

      const total = allFeedback?.length || 0;
      const pending = allFeedback?.filter(f => f.status === 'pending').length || 0;
      const reviewed = allFeedback?.filter(f => f.status === 'reviewed').length || 0;
      const resolved = allFeedback?.filter(f => f.status === 'resolved').length || 0;
      const archived = allFeedback?.filter(f => f.status === 'archived').length || 0;
      const responded = allFeedback?.filter(f => f.responded).length || 0;

      // Today's feedback
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = allFeedback?.filter(f => 
        new Date(f.created_at) >= today
      ).length || 0;

      // This week's feedback
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const thisWeekCount = allFeedback?.filter(f => 
        new Date(f.created_at) >= weekStart
      ).length || 0;

      // This month's feedback
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const thisMonthCount = allFeedback?.filter(f => 
        new Date(f.created_at) >= monthStart
      ).length || 0;

      // Category counts
      const byCategory: Record<string, number> = {};
      allFeedback?.forEach(item => {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      });

      // Average response time calculation
      let totalResponseTime = 0;
      let responseCount = 0;
      
      allFeedback?.forEach(feedback => {
        if (feedback.responded_at && feedback.created_at) {
          const respondedAt = new Date(feedback.responded_at);
          const createdAt = new Date(feedback.created_at);
          const responseTimeHours = (respondedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          totalResponseTime += responseTimeHours;
          responseCount++;
        }
      });

      const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      return {
        total,
        pending,
        reviewed,
        resolved,
        archived,
        byCategory,
        today: todayCount,
        thisWeek: thisWeekCount,
        thisMonth: thisMonthCount,
        responded,
        avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
      };
    } catch (error) {
      console.error('Get public feedback stats error:', error);
      throw error;
    }
  }

  async getPublicFeedbackByEmail(email: string): Promise<PublicFeedback[]> {
    try {
      const { data, error } = await this.supabase.client
        .from('public_feedback')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get public feedback by email error:', error);
        throw new Error('Failed to fetch feedback by email');
      }

      return data?.map(item => {
        const feedback = new PublicFeedback();
        Object.assign(feedback, item);
        return feedback;
      }) || [];
    } catch (error) {
      console.error('Get public feedback by email service error:', error);
      throw error;
    }
  }

  async markPublicFeedbackAsSpam(id: string, reason?: string): Promise<PublicFeedback> {
    try {
      const updateData = {
        status: PublicFeedbackStatus.ARCHIVED,
        updated_at: new Date().toISOString(),
        admin_notes: `Marked as spam${reason ? `: ${reason}` : ''}`
      };

      const { data, error } = await this.supabase.client
        .from('public_feedback')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Mark as spam error:', error);
        throw new Error('Failed to mark feedback as spam');
      }

      const feedback = new PublicFeedback();
      Object.assign(feedback, data);
      return feedback;
    } catch (error) {
      console.error('Mark as spam service error:', error);
      throw error;
    }
  }

  async addAdminNoteToPublicFeedback(
    feedbackId: string,
    note: string,
    adminId: string
  ): Promise<PublicFeedback> {
    try {
      // Get current notes
      const { data: currentData } = await this.supabase.client
        .from('public_feedback')
        .select('admin_notes')
        .eq('id', feedbackId)
        .single();

      const currentNotes = currentData?.admin_notes || '';
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] Admin ${adminId}: ${note}`;
      const updatedNotes = currentNotes ? `${currentNotes}\n${newNote}` : newNote;

      const { data, error } = await this.supabase.client
        .from('public_feedback')
        .update({
          admin_notes: updatedNotes,
          updated_at: timestamp
        })
        .eq('id', feedbackId)
        .select('*')
        .single();

      if (error) {
        console.error('Add admin note error:', error);
        throw new Error('Failed to add admin note');
      }

      const feedback = new PublicFeedback();
      Object.assign(feedback, data);
      return feedback;
    } catch (error) {
      console.error('Add admin note service error:', error);
      throw error;
    }
  }

  // ================ COMBINED STATISTICS ================

  async getCombinedFeedbackStats(): Promise<{
    authenticated: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
    };
    public: PublicFeedbackStats;
    overall: {
      total: number;
      pending: number;
      avgResponseTime: number;
    };
  }> {
    try {
      const [authStats, publicStats] = await Promise.all([
        this.getFeedbackStats(),
        this.getPublicFeedbackStats()
      ]);

      const overallTotal = authStats.total + publicStats.total;
      const overallPending = authStats.pending + publicStats.pending;

      return {
        authenticated: {
          total: authStats.total,
          pending: authStats.pending,
          reviewed: authStats.reviewed,
          resolved: authStats.resolved,
        },
        public: publicStats,
        overall: {
          total: overallTotal,
          pending: overallPending,
          avgResponseTime: publicStats.avgResponseTime,
        },
      };
    } catch (error) {
      console.error('Get combined stats error:', error);
      throw error;
    }
  }
}