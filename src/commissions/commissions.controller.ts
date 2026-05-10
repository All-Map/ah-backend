import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CommissionsService } from './commissions.service';
import {
  ApprovePayoutDto,
  MarkPayoutPaidDto,
  RejectPayoutDto,
  RequestPayoutDto,
} from './dto/payout.dto';

// ─── AGENT ROUTES ─────────────────────────────────────────────
@Controller('agent/commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.hostel_admin, UserRole.super_admin)
export class AgentCommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: any) {
    return this.commissions.getAgentSummary(user.id ?? user.sub);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.commissions.listAgentCommissions(user.id ?? user.sub);
  }

  @Get('payouts')
  listPayouts(@CurrentUser() user: any) {
    return this.commissions.listAgentPayouts(user.id ?? user.sub);
  }

  @Post('payouts/request')
  requestPayout(@CurrentUser() user: any, @Body() dto: RequestPayoutDto) {
    return this.commissions.requestPayout(user.id ?? user.sub, dto);
  }
}

// ─── SUPER-ADMIN ROUTES ───────────────────────────────────────
@Controller('admin/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin)
export class AdminPayoutsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('overview')
  overview() {
    return this.commissions.getOverview();
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('method') method?: 'momo' | 'bank',
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.commissions.listAllPayouts({
      status,
      agentId,
      method,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      from,
      to,
      search,
    });
  }

  @Post('bulk-approve')
  bulkApprove(@CurrentUser() user: any, @Body() dto: { ids: string[] }) {
    return this.commissions.bulkApprove(dto.ids ?? [], user.id ?? user.sub);
  }

  @Post('bulk-mark-paid')
  bulkMarkPaid(
    @CurrentUser() user: any,
    @Body() dto: { ids: string[]; batchReference: string; notes?: string },
  ) {
    return this.commissions.bulkMarkPaid(
      dto.ids ?? [],
      dto.batchReference,
      user.id ?? user.sub,
      dto.notes,
    );
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissions.getPayoutById(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: ApprovePayoutDto,
  ) {
    return this.commissions.approvePayout(id, user.id ?? user.sub, dto);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.commissions.rejectPayout(id, user.id ?? user.sub, dto);
  }

  @Patch(':id/mark-paid')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: MarkPayoutPaidDto,
  ) {
    return this.commissions.markPayoutPaid(id, user.id ?? user.sub, dto);
  }
}

// ─── SUPER-ADMIN COMMISSIONS ──────────────────────────────────
@Controller('admin/commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin)
export class AdminCommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('agentId') agentId?: string) {
    return this.commissions.listAllCommissions({ status, agentId });
  }

  @Get('by-hostel')
  byHostel() {
    return this.commissions.getCommissionsByHostel();
  }

  @Patch(':id/release')
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.commissions.releaseCommission(id, user.id ?? user.sub);
  }

  @Patch(':id/void')
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: { reason: string },
  ) {
    return this.commissions.voidCommission(id, user.id ?? user.sub, dto.reason);
  }
}
