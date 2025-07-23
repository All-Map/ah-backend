import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateVerificationDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @IsString()
  @IsNotEmpty()
  idType: string;

  @IsString()
  @IsOptional()
  otherIdType?: string;

  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @IsString()
  @IsNotEmpty()
  hostelProofType: string;

  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;
}

export class UpdateVerificationStatusDto {
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}