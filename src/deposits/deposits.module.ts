import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { Deposit } from '../entities/deposit.entity';
import { User } from '../entities/user.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { PaystackService } from '../paystack/paystack.service';
import { AuthService } from 'src/auth/auth.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { BookingsModule } from 'src/bookings/booking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit, User, Booking, Payment]),
    forwardRef(() => BookingsModule), // ✅ fix circular import
  ],
  controllers: [DepositsController],
  providers: [
    DepositsService,
    PaystackService,
    AuthService,
    SupabaseService,
    JwtService,
    MailService,
  ],
  exports: [DepositsService],
})
export class DepositsModule {}
