import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailModule } from 'src/mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminVerificationService } from './admin-verification.service';
import { AdminController } from './admin.controller';
import { FileUploadService } from 'src/file/file-upload.service';
import { ProfileModule } from 'src/profile/profile.module';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UserManagementModule } from 'src/admin/users/user-management.module';

@Module({
  imports: [
    PassportModule,
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    PrismaModule,
    MailModule,
    ProfileModule,
    UserManagementModule,
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    AdminVerificationService,
    FileUploadService,
    CloudinaryService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
