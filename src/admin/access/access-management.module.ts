import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessManagementController } from './access-management.controller';
import { AccessManagementService } from './access-management.service';
import { Access } from '../../entities/access.entity';
import { User } from '../../entities/user.entity';
import { PreviewUsage } from '../../entities/preview-usage.entity';
import { PreviewUsageModule } from '../../preview/preview-usage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Access, User, PreviewUsage]),
    PreviewUsageModule,
  ],
  controllers: [AccessManagementController],
  providers: [AccessManagementService],
  exports: [AccessManagementService],
})
export class AccessManagementModule {}