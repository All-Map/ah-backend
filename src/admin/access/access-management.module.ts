import { Module } from '@nestjs/common';
import { AccessManagementController } from './access-management.controller';
import { AccessManagementService } from './access-management.service';
import { PreviewUsageModule } from '../../preview/preview-usage.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PreviewUsageModule],
  controllers: [AccessManagementController],
  providers: [AccessManagementService],
  exports: [AccessManagementService],
})
export class AccessManagementModule {}
