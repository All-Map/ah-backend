import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from 'src/entities/user.entity';
import { MailModule } from 'src/mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminVerification } from 'src/entities/admin-verification.entity';
import { AdminVerificationService } from './admin-verification.service';
import { AdminController } from './admin.controller';
import { FileUploadService } from 'src/file/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AdminVerification]),
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
    SupabaseModule,
    MailModule,
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    JwtStrategy,
    AdminVerificationService, // <-- move here
    FileUploadService,        // <-- move here
  ],
  exports: [AuthService],
})
export class AuthModule {}