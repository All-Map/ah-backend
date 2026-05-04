import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerificationService } from './admin-verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtUser } from './types/jwt-user';
import { FileUploadService } from 'src/file/file-upload.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserManagementService } from 'src/admin/users/user-management.service';

// Extend Express Request interface to include 'user'
declare module 'express' {
  interface Request {
    user?: JwtUser;
  }
}

interface School {
  id: string;
  name: string;
  domain: string;
  location: string;
}


@Controller('admin')
export class AdminController {
  constructor(
    private readonly verificationService: AdminVerificationService,
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
    private readonly userManagementService: UserManagementService
  ) {}

  @Get('verification/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPendingVerifications() {
    return this.verificationService.getPendingVerifications();
  }

  @Post('verification/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async approveVerification(@Param('id') id: string, @Req() req: Request) {
    const superAdmin = req.user as JwtUser;
    return this.verificationService.updateVerificationStatus(id, 'approved', superAdmin);
  }

  @Post('verification/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async rejectVerification(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: Request) {
    const superAdmin = req.user as JwtUser;
    return this.verificationService.updateVerificationStatus(id, 'rejected', superAdmin, body.reason);
  }

@Get('verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
async getVerifications(@Query('status') status?: string) {
  return this.verificationService.getVerifications(status);
}

@Post('verification')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AnyFilesInterceptor())
async submitVerification(
  @Req() req: Request,
  @UploadedFiles() files: MulterFile[],
  @Body() body: any
) {
  const user = req.user as JwtUser;
  
  const idFiles = files.filter(f => f.fieldname === 'idDocuments');
  const hostelProofFiles = files.filter(f => f.fieldname === 'hostelProofDocuments');

  const idDocumentPaths = await Promise.all(
    idFiles.map(file => this.fileUploadService.uploadFile('id-documents', file))
  );
  
  const hostelProofPaths = await Promise.all(
    hostelProofFiles.map(file => this.fileUploadService.uploadFile('hostel-proofs', file))
  );

  return this.verificationService.createVerificationRequest(
    user,
    body,
    idDocumentPaths,
    hostelProofPaths
  );
}
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getVerificationStatus(@CurrentUser() user: JwtUser) {
    const verification = await this.verificationService.getUserVerificationStatus(user.id);
    
    return {
      status: verification?.status || 'unverified',
      lastUpdated: (verification as { reviewed_at?: string } | null)?.reviewed_at
    };
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.super_admin)
  async updateUserRole(
    @Param('id') userId: string,
    @Body() body: { role: 'student' | 'hostel_admin' }
  ) {
    return this.userManagementService.updateUserRole(userId, body.role as UserRole);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.super_admin)
  async deleteUser(@Param('id') userId: string) {
    return this.userManagementService.deleteUser(userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.super_admin, UserRole.hostel_admin)
  async getUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('is_verified') is_verified?: string,
    @Query('search') search?: string,
    @Query('school_id') school_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters = {
        role: role as UserRole,
        status: status as any,
        is_verified: is_verified ? is_verified === 'true' : undefined,
        search,
        school_id,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50
      };

      const result = await this.userManagementService.getUsers(filters);
      const stats = await this.userManagementService.getOverallUserStats();

      return { 
        users: result.users, 
        stats,
        pagination: result.pagination
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to fetch users: ${error.message}`);
    }
  }
}