import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomTypeDto } from './create-room-type.dto';

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {}

// dto/create-room.dto.ts
import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, IsPositive } from 'class-validator';
import { RoomStatus } from 'src/entities/room.entity';

export class CreateRoomDto {
  @IsString()
  roomTypeId: string;

  @IsString()
  roomNumber: string;

  @IsOptional()
  @IsNumber()
  floor?: number;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentOccupancy?: number;

  @IsNumber()
  @IsPositive()
  maxOccupancy: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
