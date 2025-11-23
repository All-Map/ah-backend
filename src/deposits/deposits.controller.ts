import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
  Request,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepositsService } from './deposits.service';
import {
  CreateDepositDto,
  VerifyDepositDto,
  DepositFilterDto,
  ApplyDepositToBookingDto,
} from './dto/deposit.dto';
import { Deposit } from '../entities/deposit.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Deposits')
@Controller('deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Post()
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new deposit record' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Deposit created successfully',
    type: Deposit,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createDeposit(
    @Body() createDepositDto: CreateDepositDto,
    @Request() req: any,
  ): Promise<Deposit> {
    return await this.depositsService.createDeposit(createDepositDto, req.user.id);
  }

  @Post('verify')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Verify a deposit payment with Paystack' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit verified successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Deposit verification failed',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async verifyDeposit(@Body() verifyDepositDto: VerifyDepositDto) {
    const result = await this.depositsService.verifyDeposit(verifyDepositDto);
    return {
      message: result.verified ? 'Deposit verified successfully' : 'Deposit was already verified',
      deposit: result.deposit,
      verified: result.verified,
    };
  }

  @Get('balance')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user deposit balance' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Balance retrieved successfully',
  })
  async getBalance(@Request() req: any) {
    return await this.depositsService.getUserDepositBalance(req.user.id);
  }

  @Get()
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user deposits with filtering' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'completed', 'failed', 'refunded'] })
  @ApiQuery({ name: 'depositType', required: false, enum: ['booking_deposit', 'room_balance', 'account_credit'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposits retrieved successfully',
  })
  async getUserDeposits(
    @Request() req: any,
    @Query() filterDto: DepositFilterDto,
  ) {
    const result = await this.depositsService.getUserDeposits(req.user.id, filterDto);
    return {
      deposits: result.deposits,
      pagination: {
        page: filterDto.page || 1,
        limit: filterDto.limit || 10,
        total: result.total,
        totalPages: Math.ceil(result.total / (filterDto.limit || 10)),
      },
    };
  }

  @Get('admin')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all deposits (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposits retrieved successfully',
  })
  async getAllDeposits(@Query() filterDto: DepositFilterDto) {
    const result = await this.depositsService.getUserDeposits(filterDto.userId || '*', filterDto);
    return {
      deposits: result.deposits,
      pagination: {
        page: filterDto.page || 1,
        limit: filterDto.limit || 10,
        total: result.total,
        totalPages: Math.ceil(result.total / (filterDto.limit || 10)),
      },
    };
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get deposit by ID' })
  @ApiParam({ name: 'id', description: 'Deposit ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit retrieved successfully',
    type: Deposit,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Deposit not found',
  })
  async getDepositById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<Deposit> {
    // Students can only see their own deposits, admins can see any
    const userId = req.user.role === UserRole.STUDENT ? req.user.id : undefined;
    return await this.depositsService.getDepositById(id, userId);
  }

  @Post('apply-to-booking')
  @Roles(UserRole.STUDENT, UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Apply deposit balance to a booking' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit applied to booking successfully',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async applyDepositToBooking(
    @Body() applyDto: ApplyDepositToBookingDto,
    @Request() req: any,
  ) {
    const result = await this.depositsService.applyDepositToBooking(applyDto, req.user.id);
    return {
      message: `Successfully applied ${result.appliedAmount} GHS to booking`,
      deposit: result.deposit,
      booking: result.booking,
      appliedAmount: result.appliedAmount,
    };
  }

  @Patch(':id/refund')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refund a deposit (Super Admin only)' })
  @ApiParam({ name: 'id', description: 'Deposit ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit refunded successfully',
  })
  async refundDeposit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    const deposit = await this.depositsService.refundDeposit(id, reason);
    return {
      message: 'Deposit refunded successfully',
      deposit,
    };
  }

  @Post('cleanup/expired')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Clean up expired deposits (System operation)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Expired deposits cleaned up',
  })
  async cleanupExpiredDeposits() {
    const result = await this.depositsService.cleanupExpiredDeposits();
    return {
      message: `Cleaned up ${result.cleaned} expired deposits`,
      cleaned: result.cleaned,
    };
  }
}