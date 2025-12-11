import { 
  Injectable, 
  BadRequestException, 
  InternalServerErrorException,
  Logger 
} from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { PaystackService } from 'src/paystack/paystack.service';
import { PreviewUsageService } from 'src/preview/preview-usage.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly ACCESS_PRICE = 38 * 100; // 38 GHS in pesewas
  private readonly ACCESS_DAYS = 30;

  constructor(
    private paystackService: PaystackService,
    private accessService: AccessService,
    private previewUsageService: PreviewUsageService,
  ) {}

async initiatePayment(userId: string, dto: { amount: number; email: string }) {
  // Validate amount
  if (dto.amount !== this.ACCESS_PRICE) {
    throw new BadRequestException(`Amount must be ${this.ACCESS_PRICE / 100} GHS`);
  }

  // Check if user already has active access
  const { active, expiry } = await this.accessService.checkAccess(userId);
  if (active) {
    // Instead of throwing error, return info about existing access
    return {
      already_has_access: true,
      message: 'User already has active access',
      expires_at: expiry,
      current_time: new Date(),
    };
  }

  // Generate unique reference
  const reference = `access_${Date.now()}_${userId}`;

  // Initialize Paystack transaction
  const response = await this.paystackService.initializeTransaction({
    email: dto.email,
    amount: dto.amount,
    reference,
    callback_url: `${process.env.FRONTEND_URL}/payment/callback?reference=${reference}`,
  });

  if (!response.status) {
    throw new InternalServerErrorException('Failed to initialize payment');
  }

  return {
    authorization_url: response.data.authorization_url,
    reference,
  };
}

// Add to payments.service.ts
async trackPreviewUsage(data: {
  userId: string;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): Promise<{ tracked: boolean; message: string }> {
  try {
    // Check if user already has paid access
    const { active } = await this.checkAccess(data.userId);
    if (active) {
      return { tracked: false, message: 'User already has paid access' };
    }

    await this.previewUsageService.markPreviewAsUsed(data);
    
    return { 
      tracked: true, 
      message: 'Preview usage tracked successfully' 
    };
  } catch (error) {
    this.logger.error('Failed to track preview usage:', error);
    throw new BadRequestException('Failed to track preview usage');
  }
}

async getPreviewStatus(userId: string): Promise<{
  canAccessPreview: boolean;
  hasUsedPreview: boolean;
  lastUsage?: Date;
  hasPaidAccess: boolean;
}> {
  const { active, previewUsed } = await this.checkAccess(userId);
  
  let lastUsage: Date | undefined = undefined;
  
  if (previewUsed) {
    const previewUsage = await this.previewUsageService.getLastPreviewUsage(userId);
    // Extract the usedAt date from the PreviewUsage object
    lastUsage = previewUsage?.usedAt;
  }

  return {
    canAccessPreview: !previewUsed && !active,
    hasUsedPreview: !!previewUsed,
    lastUsage, // Now this will be a Date or undefined
    hasPaidAccess: active,
  };
}
async handleWebhook(signature: string, payload: any) {
    // Validate webhook signature
    const isValid = this.paystackService.validateWebhookSignature(payload, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Handle the event
    if (payload.event === 'charge.success') {
      const reference = payload.data.reference;
      
      try {
        // Verify and process the payment
        await this.verifyPayment(reference);
        this.logger.log(`Webhook processed successfully for reference: ${reference}`);
      } catch (error) {
        this.logger.error(`Webhook processing failed for ${reference}:`, error);
      }
    }

    return { received: true };
  }

async verifyAndGrantAccess(reference: string) {
  try {
    // Check if access already granted for this reference
    const existingAccess = await this.accessService.getAccessByPaystackReference(reference);
    
    if (existingAccess) {
      // Access already granted for this payment
      this.logger.log(`Payment ${reference} already processed`);
      return {
        success: true,
        message: 'Payment already verified and access granted',
        already_processed: true,
        expires_at: existingAccess.expiresAt,
      };
    }

    // Verify with Paystack
    const transaction = await this.paystackService.verifyTransaction(reference);

    // Check if payment was successful
    if (transaction.status !== 'success') {
      throw new BadRequestException(`Payment not successful: ${transaction.gateway_response}`);
    }

    // Extract user ID from reference
    const userId = reference.split('_')[2];

    // Check if user already has active access (to extend it)
    const userAccess = await this.accessService.checkAccess(userId);
    
    let newExpiresAt: Date;
    
    if (userAccess.active && userAccess.expiry) {
      // Extend existing access from the current expiry date
      newExpiresAt = new Date(userAccess.expiry.getTime() + this.ACCESS_DAYS * 24 * 60 * 60 * 1000);
    } else {
      // Start new access from now
      newExpiresAt = new Date(Date.now() + this.ACCESS_DAYS * 24 * 60 * 60 * 1000);
    }

    // Grant or extend access
    await this.accessService.grantAccess(userId, this.ACCESS_DAYS, reference);

    return {
      success: true,
      message: 'Payment verified and access granted',
      access_granted: true,
      expires_at: newExpiresAt,
      reference,
    };
  } catch (error) {
    this.logger.error('Payment verification failed:', error);
    throw error;
  }
}

async verifyPayment(reference: string) {
  return this.verifyAndGrantAccess(reference);
}

  async checkAccess(userId: string) {
    return this.accessService.checkAccess(userId);
  }
}