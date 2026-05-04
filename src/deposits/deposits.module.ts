import { Module, forwardRef } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { PaystackService } from '../paystack/paystack.service';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { BookingsModule } from 'src/bookings/booking.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, forwardRef(() => BookingsModule)],
  controllers: [DepositsController],
  providers: [
    DepositsService,
    PaystackService,
    AuthService,
    JwtService,
    MailService,
  ],
  exports: [DepositsService],
})
export class DepositsModule {}
