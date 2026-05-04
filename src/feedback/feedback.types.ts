export enum FeedbackCategory {
  GENERAL = 'general',
  BUG = 'bug',
  FEATURE = 'feature',
  FEEDBACK = 'feedback',
  SUPPORT = 'support',
}

export enum FeedbackStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived',
}

export class Feedback {
  id: string;
  userId: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PublicFeedbackCategory {
  GENERAL = 'general',
  BUG = 'bug',
  FEATURE = 'feature',
  FEEDBACK = 'feedback',
  SUPPORT = 'support',
}

export enum PublicFeedbackStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived',
}

export class PublicFeedback {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  adminNotes: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string;
  userAgent: string;
  responded: boolean;
  respondedAt: Date;
}

export interface PublicFeedbackStats {
  total: number;
  pending: number;
  reviewed: number;
  resolved: number;
  archived: number;
  byCategory: Record<string, number>;
  responded: number;
  todayCount?: number;
  thisWeekCount?: number;
  thisMonthCount?: number;
  /** Legacy / analytics aliases used by feedback.service */
  today?: number;
  thisWeek?: number;
  thisMonth?: number;
  avgResponseTime?: number;
}
