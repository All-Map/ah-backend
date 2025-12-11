import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AccessService } from 'src/access/access.service';
import { Access } from 'src/entities/access.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PaystackService } from 'src/paystack/paystack.service';
import { PreviewUsageModule } from 'src/preview/preview-usage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Access]),
    AuthModule,
    PreviewUsageModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackService, AccessService],
  exports: [AccessService, PaystackService],
})
export class PaymentsModule {}