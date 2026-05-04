import { Module } from '@nestjs/common';
import { BookingManagementController } from './booking-management.controller';
import { BookingManagementService } from './booking-management.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BookingManagementController],
  providers: [BookingManagementService],
  exports: [BookingManagementService],
})
export class BookingManagementModule {}
