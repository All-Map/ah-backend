import { Body, Controller, Get, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
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

// Extend Express Request interface to include 'user'
declare module 'express' {
  interface Request {
    user?: User;
  }
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
  @Roles(UserRole.SUPER_ADMIN)
  async getPendingVerifications() {
    return this.verificationService.getPendingVerifications();
  }

  @Post('verification/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async approveVerification(@Param('id') id: string, @Req() req: Request) {
    const superAdmin = req.user as User;
    return this.verificationService.updateVerificationStatus(id, 'approved', superAdmin);
  }

  @Post('verification/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async rejectVerification(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: Request) {
    const superAdmin = req.user as User;
    return this.verificationService.updateVerificationStatus(id, 'rejected', superAdmin, body.reason);
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
  // const formData = JSON.parse(body.formData);
  
  // Separate files
  const idFiles = files.filter(f => f.fieldname === 'idDocuments');
  const hostelProofFiles = files.filter(f => f.fieldname === 'hostelProofDocuments');

  // Upload files
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
}