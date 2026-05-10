import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import {
  AdminCommissionsController,
  AdminPayoutsController,
  AgentCommissionsController,
} from './commissions.controller';

@Module({
  controllers: [
    AgentCommissionsController,
    AdminPayoutsController,
    AdminCommissionsController,
  ],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
