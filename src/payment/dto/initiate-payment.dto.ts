import { IsString, IsNotEmpty, IsNumber, IsEmail } from 'class-validator';

export class InitiatePaymentDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  reference: string;
}