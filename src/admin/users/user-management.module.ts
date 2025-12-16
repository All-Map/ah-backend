import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';
import { User } from '../../entities/user.entity';
import { Booking } from '../../entities/booking.entity';
import { Hostel } from '../../entities/hostel.entity';
import { School } from '../../entities/school.entity';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking, Hostel, School]),
    MailModule,
  ],
  controllers: [UserManagementController],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class UserManagementModule {}