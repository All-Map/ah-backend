import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PaystackVerificationResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: {
      custom_fields: Array<{
        display_name: string;
        variable_name: string;
        value: string;
      }>;
    };
    fees_breakdown: any;
    log: any;
    fees: number;
    fees_split: any;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
      account_name: string | null;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
      international_format_phone: string | null;
    };
    plan: any;
    split: any;
    order_id: any;
    paidAt: string;
    createdAt: string;
    requested_amount: number;
    pos_transaction_data: any;
    source: any;
    fees_breakdown_breakdown: any;
  };
}

export interface PaystackTransaction {
  reference: string;
  amount: number;
  status: 'success' | 'failed' | 'abandoned';
  gateway_response: string;
  paid_at: string;
  created_at: string;
  customer: {
    email: string;
  };
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }
    this.secretKey = secret;
  }

    async verifyTransaction(reference: string): Promise<PaystackTransaction> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Paystack verification failed:', error.response?.data);
      throw error;
    }
  }

  /**
   * Verify a payment transaction with Paystack
   * @param reference - The payment reference from Paystack
   * @returns PaystackVerificationResponse
   */
  async verifyPayment(reference: string): Promise<PaystackVerificationResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        throw new BadRequestException('Payment reference not found');
      }
      
      throw new InternalServerErrorException('Failed to verify payment with Paystack');
    }
  }

    validateWebhookSignature(payload: any, signature: string): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  }

  /**
   * Validate payment amount and status
   * @param verification - Paystack verification response
   * @param expectedAmount - Expected amount in GHS
   * @returns boolean
   */
  validatePayment(verification: PaystackVerificationResponse, expectedAmount: number): boolean {
    if (!verification.status) {
      throw new BadRequestException('Payment verification failed');
    }

    if (verification.data.status !== 'success') {
      throw new BadRequestException(`Payment was not successful. Status: ${verification.data.status}`);
    }

    // Convert amount from kobo to GHS
    const paidAmount = verification.data.amount / 100;
    
    if (paidAmount !== expectedAmount) {
      throw new BadRequestException(
        `Payment amount mismatch. Expected: ${expectedAmount} GHS, Received: ${paidAmount} GHS`
      );
    }

    return true;
  }

    async initializeTransaction(data: {
    email: string;
    amount: number; // in pesewas (100 = 1 GHS)
    reference: string;
    callback_url: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        data,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Paystack initialization failed:', error.response?.data);
      throw error;
    }
  }

  /**
   * Initialize a payment transaction (for server-side initialization if needed)
   * @param email - Customer email
   * @param amount - Amount in GHS
   * @param reference - Unique reference
   * @param metadata - Additional metadata
   */
  async initializePayment(
    email: string,
    amount: number,
    reference: string,
    metadata?: any
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert to kobo
          reference,
          currency: 'GHS',
          metadata,
          callback_url: this.configService.get<string>('PAYSTACK_CALLBACK_URL'),
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to initialize payment');
    }
  }

  /**
   * Get transaction details
   * @param reference - Payment reference
   */
  async getTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Paystack transaction fetch error:', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to fetch transaction details');
    }
  }

  /**
   * Format amount for display
   * @param amount - Amount in GHS
   * @returns Formatted amount string
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2,
    }).format(amount);
  }
}