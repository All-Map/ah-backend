import { Module, forwardRef } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { PaystackService } from 'src/paystack/paystack.service';
import { DepositsModule } from 'src/deposits/deposits.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, forwardRef(() => DepositsModule)],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    AuthService,
    JwtService,
    MailService,
    PaystackService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
