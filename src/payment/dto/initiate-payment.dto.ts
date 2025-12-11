export class InitiatePaymentDto {
  amount: number;
  email: string;
}

export class VerifyPaymentDto {
  reference: string;
}