import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { AccessManagementService } from './access-management.service';

@ApiTags('Admin Access')
@Controller('admin/access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AccessManagementController {
  constructor(private readonly accessService: AccessManagementService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all access records with filtering' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access records retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status: active, expired, upcoming' })
  async getAccessRecords(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('status') status?: 'active' | 'expired' | 'upcoming',
  ) {
    return await this.accessService.getAccessRecords({
      page,
      limit,
      search,
      source,
      status,
    });
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get access statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access statistics retrieved successfully',
  })
  async getAccessStats() {
    return await this.accessService.getAccessStats();
  }

  @Get('preview-usage')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get preview usage records' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preview usage records retrieved successfully',
  })
  async getPreviewUsage(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.accessService.getPreviewUsage(page, limit);
  }

  @Get('preview-usage/stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get preview usage statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preview usage statistics retrieved successfully',
  })
  async getPreviewUsageStats() {
    return await this.accessService.getPreviewUsageStats();
  }

  @Get('user/:userId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get access history for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User access history retrieved successfully',
  })
  async getUserAccessHistory(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.accessService.getUserAccessHistory(userId);
  }

  @Get('revenue')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get revenue statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Revenue statistics retrieved successfully',
  })
  async getRevenueStats(
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
  ) {
    return await this.accessService.getRevenueStats(period);
  }

  @Post('grant/:userId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Grant access to a user manually' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access granted successfully',
  })
  async grantManualAccess(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('days') days: number = 30,
    @Query('source') source: string = 'manual_grant',
  ) {
    return await this.accessService.grantManualAccess(userId, days, source);
  }

  @Patch('extend/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Extend access expiration' })
  @ApiParam({ name: 'id', description: 'Access record ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access extended successfully',
  })
  async extendAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days: number = 30,
  ) {
    return await this.accessService.extendAccess(id, days);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke access' })
  @ApiParam({ name: 'id', description: 'Access record ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access revoked successfully',
  })
  async revokeAccess(@Param('id', ParseUUIDPipe) id: string) {
    return await this.accessService.revokeAccess(id);
  }

  @Get('export')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export access records to CSV' })
  async exportAccessRecords(
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('status') status?: 'active' | 'expired' | 'upcoming',
  ) {
    return await this.accessService.exportAccessRecords(search, source, status);
  }
}