// room.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, Min, Max, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from 'src/entities/room.entity';

export class CreateRoomDto {
  @ApiProperty({ description: 'Hostel ID' })
  @IsNotEmpty()
  @IsUUID()
  hostelId: string;

  @ApiProperty({ description: 'Room type ID' })
  @IsNotEmpty()
  @IsUUID()
  roomTypeId: string;

  @ApiProperty({ description: 'Room number', example: 'A101' })
  @IsNotEmpty()
  @IsString()
  roomNumber: string;

  @ApiPropertyOptional({ description: 'Floor number', example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floor?: number;

  @ApiProperty({ description: 'Maximum occupancy', example: 2 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  maxOccupancy: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRoomDto {
  @ApiPropertyOptional({ description: 'Room number', example: 'A101' })
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional({ description: 'Floor number', example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional({ description: 'Room status', enum: RoomStatus })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ description: 'Maximum occupancy', example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  maxOccupancy?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RoomFilterDto {
  @ApiPropertyOptional({ description: 'Hostel ID' })
  @IsOptional()
  @IsUUID()
  hostelId?: string;

  @ApiPropertyOptional({ description: 'Room type ID' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional({ description: 'Room status', enum: RoomStatus })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ description: 'Floor number' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional({ description: 'Filter by availability', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  available?: boolean;

  @ApiPropertyOptional({ description: 'Search term for room number or hostel name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 10, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    description: 'Sort field', 
    enum: ['roomNumber', 'floor', 'status', 'currentOccupancy', 'createdAt'],
    default: 'roomNumber'
  })
  @IsOptional()
  @IsString()
  sortBy?: 'roomNumber' | 'floor' | 'status' | 'currentOccupancy' | 'createdAt' = 'roomNumber';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

export class BulkCreateRoomDto {
  @ApiProperty({ description: 'Hostel ID' })
  @IsNotEmpty()
  @IsUUID()
  hostelId: string;

  @ApiProperty({ description: 'Room type ID' })
  @IsNotEmpty()
  @IsUUID()
  roomTypeId: string;

  @ApiPropertyOptional({ description: 'Floor number', example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floor?: number;

  @ApiProperty({ description: 'Maximum occupancy for all rooms', example: 2 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  maxOccupancy: number;

  @ApiProperty({ 
    description: 'Array of room numbers to create', 
    example: ['A101', 'A102', 'A103'] 
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  roomNumbers: string[];

  @ApiPropertyOptional({ description: 'Additional notes for all rooms' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOccupancyDto {
  @ApiProperty({ description: 'Current occupancy count', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentOccupancy: number;
}

export class BulkDeleteRoomsDto {
  @ApiProperty({ description: 'Array of room IDs to delete' })
  @IsNotEmpty()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids: string[];
}

export class ChangeRoomStatusDto {
  @ApiProperty({ description: 'New room status', enum: RoomStatus })
  @IsNotEmpty()
  @IsEnum(RoomStatus)
  status: RoomStatus;
}

export class RoomSearchDto {
  @ApiProperty({ description: 'Search term' })
  @IsNotEmpty()
  @IsString()
  searchTerm: string;

  @ApiPropertyOptional({ description: 'Hostel ID to filter by' })
  @IsOptional()
  @IsUUID()
  hostelId?: string;

  @ApiPropertyOptional({ description: 'Room status to filter by', enum: RoomStatus })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ description: 'Filter by availability' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  available?: boolean;
}