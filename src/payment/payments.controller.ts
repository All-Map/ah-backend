import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  Headers, 
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { InitiatePaymentDto, VerifyPaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';
import { PreviewUsageService } from 'src/preview/preview-usage.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly previewUsageService: PreviewUsageService,
  ) {}

  @Post('initiate')
  async initiatePayment(@Body() body: InitiatePaymentDto & { userId: string }) {
    return this.paymentsService.initiatePayment(body.userId, body);
  }

 @Post('track-preview')
  async trackPreviewUsage(
    @Body() body: { userId: string; source?: string; metadata?: any },
    @Req() req: any
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    return this.paymentsService.trackPreviewUsage({
      userId: body.userId,
      source: body.source,
      ipAddress,
      userAgent,
      metadata: body.metadata,
    });
  }

  @Get('preview-status/:userId')
  async getPreviewStatus(@Param('userId') userId: string) {
    return this.paymentsService.getPreviewStatus(userId);
  }

  @Get('preview-stats')
  async getPreviewStats() {
    return this.previewUsageService.getPreviewUsageStats();
  }

  @Post('reset-preview/:userId')
  async resetPreview(@Param('userId') userId: string) {
    await this.previewUsageService.resetPreviewUsage(userId);
    return { message: 'Preview usage reset for user' };
  }

  @Get('verify')
  async verifyPayment(@Query() query: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(query.reference);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: any,
  ) {
    return this.paymentsService.handleWebhook(signature, req.body);
  }

  @Get('access/check')
  async checkAccess(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    return this.paymentsService.checkAccess(userId);
  }
}