import { IsEnum, IsOptional, IsString, IsObject, MinLength } from 'class-validator';
import { AgentPayoutMethod } from '@prisma/client';

export class RequestPayoutDto {
  /**
   * Optional. Defaults to the agent's verified payout method on file.
   */
  @IsOptional()
  @IsEnum(AgentPayoutMethod)
  method?: AgentPayoutMethod;

  /**
   * Optional. Defaults to the agent's verified payout destination on file.
   * MoMo: { provider, phone, accountName }
   * Bank: { bankName, bankCode?, accountNumber, accountName }
   */
  @IsOptional()
  @IsObject()
  destination?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApprovePayoutDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectPayoutDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class MarkPayoutPaidDto {
  @IsString()
  transactionRef!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
