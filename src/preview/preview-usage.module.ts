import { Module } from '@nestjs/common';
import { PreviewUsageService } from './preview-usage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PreviewUsageService],
  exports: [PreviewUsageService],
})
export class PreviewUsageModule {}
