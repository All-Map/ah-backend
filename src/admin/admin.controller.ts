import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics for super admin' })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard statistics retrieved successfully' 
  })
  async getDashboardStats() {
    return await this.adminService.getDashboardStats();
  }

  @Get('dashboard/recent-activities')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get recent activities for dashboard' })
  @ApiResponse({ 
    status: 200, 
    description: 'Recent activities retrieved successfully' 
  })
  async getAdminRecentActivities(@Query('limit') limit?: number) {
    return await this.adminService.getRecentActivities(limit || 10);
  }

  @Get('dashboard/users/overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get users overview statistics' })
  async getUsersOverview() {
    return await this.adminService.getUsersOverview();
  }

  @Get('dashboard/bookings/overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get bookings overview statistics' })
  async getBookingsOverview() {
    return await this.adminService.getBookingsOverview();
  }

  @Get('dashboard/hostels/overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get hostels overview statistics' })
  async getHostelsOverview() {
    return await this.adminService.getHostelsOverview();
  }

  @Get('dashboard/revenue/overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get revenue overview statistics' })
  async getRevenueOverview(@Query('period') period?: 'daily' | 'weekly' | 'monthly') {
    return await this.adminService.getRevenueOverview(period || 'monthly');
  }
}