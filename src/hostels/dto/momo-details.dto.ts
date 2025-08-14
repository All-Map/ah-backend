import { IsNotEmpty, IsString } from 'class-validator';

export class MomoDetailsDto {
  @IsString()
  @IsNotEmpty()
  provider: string; // MTN, Vodafone, AirtelTigo

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}