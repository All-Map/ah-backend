import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerificationService } from './admin-verification.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Request } from 'express';
import { User, UserRole } from 'src/entities/user.entity';
import { FileUploadService } from 'src/file/file-upload.service';
import { AnyFilesInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';
import { CurrentUser } from './decorators/current-user.decorator';

// Extend Express Request interface to include 'user'
declare module 'express' {
  interface Request {
    user?: User;
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
    private readonly supabase: SupabaseService,
    private readonly fileUploadService: FileUploadService
  ) {}

  // @Post('verification')
  // @UseGuards(JwtAuthGuard)
  // async submitVerification(@Req() req: Request, @Body() body: any) {
  //   const user = req.user as User;
  //   const { formData, idDocuments, hostelProofDocuments } = body;
    
  //   return this.verificationService.createVerificationRequest(
  //     user,
  //     formData,
  //     idDocuments,
  //     hostelProofDocuments
  //   );
  // }

  @Get('verification/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.SUPER_ADMIN)
  async getPendingVerifications() {
    return this.verificationService.getPendingVerifications();
  }

  @Post('verification/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.SUPER_ADMIN)
  async approveVerification(@Param('id') id: string, @Req() req: Request) {
    const superAdmin = req.user as User;
    return this.verificationService.updateVerificationStatus(id, 'approved', superAdmin);
  }

  @Post('verification/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.SUPER_ADMIN)
  async rejectVerification(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: Request) {
    const superAdmin = req.user as User;
    return this.verificationService.updateVerificationStatus(id, 'rejected', superAdmin, body.reason);
  }

@Get('verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(UserRole.SUPER_ADMIN)
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
  const user = req.user as User;
  
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
  async getVerificationStatus(@CurrentUser() user: User) {
    const verification = await this.verificationService.getUserVerificationStatus(user.id);
    
    return {
      status: verification?.status || 'unverified',
      lastUpdated: verification?.reviewed_at
    };
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async updateUserRole(
    @Param('id') userId: string,
    @Body() body: { role: 'student' | 'hostel_admin' }
  ) {
    const { data: user, error: userError } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    const { data: updatedUser, error } = await this.supabase.client
      .from('users')
      .update({ role: body.role })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    return updatedUser;
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async deleteUser(@Param('id') userId: string) {
    const { data: user, error: userError } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    const { error } = await this.supabase.client
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    return { message: 'User deleted successfully' };
  }

  private async getUserStats() {
    const { count: total, error: totalError } = await this.supabase.client
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: verified, error: verifiedError } = await this.supabase.client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true);

    const { count: unverified, error: unverifiedError } = await this.supabase.client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', false);

    const { count: students, error: studentsError } = await this.supabase.client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    const { count: hostel_admins, error: hostelAdminsError } = await this.supabase.client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'hostel_admin');

    const { count: pending_verification, error: pendingError } = await this.supabase.client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Check for any errors
    const errors = [totalError, verifiedError, unverifiedError, studentsError, hostelAdminsError, pendingError];
    if (errors.some(error => error)) {
      throw new Error('Failed to fetch user statistics');
    }

    return {
      total: total || 0,
      verified: verified || 0,
      unverified: unverified || 0,
      students: students || 0,
      hostel_admins: hostel_admins || 0,
      pending_verification: pending_verification || 0
    };
  }

  @Get('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
async getUsers(
  @Query('role') role?: string,
  @Query('status') status?: string,
  @Query('is_verified') is_verified?: string,
  @Query('search') search?: string,
  @Query('school_id') school_id?: string
) {
  const filters = {
    role,
    status,
    is_verified: is_verified ? is_verified === 'true' : undefined,
    search,
    school_id
  };

  // Get users with filters
  let query = this.supabase.client
    .from('users')
    .select('*');

  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.is_verified !== undefined) {
    query = query.eq('is_verified', filters.is_verified);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  if (filters.school_id) {
    query = query.eq('school_id', filters.school_id);
  }

  const { data: users, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  // Get school data separately and combine
  const usersWithSchools = await Promise.all(
    users.map(async (user) => {
      let school: School | null = null;
      if (user.school_id) {
        const { data: schoolData } = await this.supabase.client
          .from('schools')
          .select('id, name, domain, location')
          .eq('id', user.school_id)
          .single();
        school = schoolData;
      }

      return {
        ...user,
        school
      };
    })
  );

  // Get user stats
  const stats = await this.getUserStats();

  return { users: usersWithSchools, stats };
}
}