import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RoomNumberRange {
  @IsString()
  prefix?: string; // e.g., "A", "Block-A"

  @IsNumber()
  startNumber: number; // e.g., 101

  @IsNumber()
  endNumber: number; // e.g., 110

  @IsOptional()
  @IsString()
  suffix?: string; // e.g., "A", "B"
}

export class BulkCreateRoomsDto {
  @IsString()
  roomTypeId: string;

  @ValidateNested()
  @Type(() => RoomNumberRange)
  roomRange: RoomNumberRange;

  @IsOptional()
  @IsNumber()
  floor?: number;

  @IsNumber()
  maxOccupancy: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
