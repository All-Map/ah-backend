import { IsString, IsNumber, IsPositive, IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DepositType, DepositStatus } from 'src/entities/deposit.entity';


export class CreateDepositDto {
  @ApiProperty({ description: 'Deposit amount in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: DepositType, default: DepositType.ACCOUNT_CREDIT })
  @IsEnum(DepositType)
  @IsOptional()
  depositType?: DepositType;

  @ApiProperty({ description: 'Payment reference from Paystack' })
  @IsString()
  paymentReference: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class VerifyDepositDto {
  @ApiProperty({ description: 'Payment reference from Paystack' })
  @IsString()
  reference: string;

  @ApiProperty({ description: 'Expected amount in GHS' })
  @IsNumber()
  @IsPositive()
  expectedAmount: number;
}

export class DepositFilterDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ enum: DepositStatus, required: false })
  @IsEnum(DepositStatus)
  @IsOptional()
  status?: DepositStatus;

  @ApiProperty({ enum: DepositType, required: false })
  @IsEnum(DepositType)
  @IsOptional()
  depositType?: DepositType;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsNumber()
  @IsOptional()
  limit?: number = 10;
}

export class ApplyDepositToBookingDto {
  @ApiProperty({ description: 'Booking ID to apply deposit to' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ description: 'Amount to apply from deposit balance' })
  @IsNumber()
  @IsPositive()
  amount: number;
}