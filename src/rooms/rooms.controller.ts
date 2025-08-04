import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateRoomDto, RoomsService } from './rooms.service';
import {
  RoomFilterDto,
  BulkCreateRoomDto,
  UpdateOccupancyDto,
  BulkDeleteRoomsDto,
  ChangeRoomStatusDto,
  RoomSearchDto,
  UpdateRoomDto,
} from './dto/rooms.dto';
import { Room, RoomStatus } from 'src/entities/room.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/entities/user.entity';
import { RoomType } from 'src/entities/room-type.entity';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';

@ApiTags('Rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('create')
  // @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Room created successfully',
    type: Room 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Room number already exists' 
  })
  async createRoom(@Body() createRoomDto: CreateRoomDto): Promise<Room> {
    return await this.roomsService.createRoom(createRoomDto);
  }

  @Post('bulk')
  
  @ApiOperation({ summary: 'Create multiple rooms at once' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Rooms created successfully',
    type: [Room] 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Some room numbers already exist' 
  })
  async bulkCreateRooms(@Body() bulkCreateDto: BulkCreateRoomDto): Promise<Room[]> {
    return await this.roomsService.bulkCreateRooms(bulkCreateDto);
  }

@Post('create-room-type')
@UsePipes(new ValidationPipe({ transform: true }))
async create(@Body() createRoomTypeDto: CreateRoomTypeDto): Promise<RoomType> {
  return this.roomsService.create(createRoomTypeDto);
}

  @Get()
  // @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get all rooms with filtering and pagination' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Rooms retrieved successfully' 
  })
  async getRooms(@Query() filterDto: RoomFilterDto) {
    return await this.roomsService.getRooms(filterDto);
  }

  @Get('search')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Search rooms by term' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Search results retrieved successfully',
    type: [Room] 
  })
  async searchRooms(@Query() searchDto: RoomSearchDto): Promise<Room[]> {
    const { searchTerm, ...filters } = searchDto;
    return await this.roomsService.searchRooms(searchTerm, filters);
  }

  @Get('available/:hostelId')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get available rooms for a hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiQuery({ 
    name: 'roomTypeId', 
    required: false, 
    description: 'Filter by room type ID' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Available rooms retrieved successfully',
    type: [Room] 
  })
  async getAvailableRooms(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query('roomTypeId') roomTypeId?: string
  ): Promise<Room[]> {
    return await this.roomsService.getAvailableRooms(hostelId, roomTypeId);
  }

  @Get('statistics/:hostelId')
  
  @ApiOperation({ summary: 'Get room statistics for a hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room statistics retrieved successfully' 
  })
  async getRoomStatistics(@Param('hostelId', ParseUUIDPipe) hostelId: string) {
    return await this.roomsService.getRoomStatistics(hostelId);
  }

  @Get('hostel/:hostelId')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get all rooms for a specific hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Hostel rooms retrieved successfully',
    type: [Room] 
  })
  async getRoomsByHostelId(
    @Param('hostelId', ParseUUIDPipe) hostelId: string,
    @Query() filterDto: Partial<RoomFilterDto>
  ): Promise<Room[]> {
    return await this.roomsService.getRoomsByHostelId(hostelId, filterDto);
  }

  @Get(':id')
  // @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room retrieved successfully',
    type: Room 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Room not found' 
  })
  async getRoomById(@Param('id', ParseUUIDPipe) id: string): Promise<Room> {
    return await this.roomsService.getRoomById(id);
  }

  @Put(':id')
  
  @ApiOperation({ summary: 'Update room details' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room updated successfully',
    type: Room 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Room not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Room number already exists' 
  })
  async updateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto
  ): Promise<Room> {
    return await this.roomsService.updateRoom(id, updateRoomDto);
  }

  @Patch(':id/occupancy')
  
  @ApiOperation({ summary: 'Update room occupancy' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room occupancy updated successfully',
    type: Room 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Room not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid occupancy value' 
  })
  async updateOccupancy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() occupancyDto: UpdateOccupancyDto
  ): Promise<Room> {
    return await this.roomsService.updateOccupancy(id, occupancyDto);
  }

  @Patch(':id/status')
  
  @ApiOperation({ summary: 'Change room status' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room status updated successfully',
    type: Room 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Room not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid status change' 
  })
  async changeRoomStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusDto: ChangeRoomStatusDto
  ): Promise<Room> {
    return await this.roomsService.changeRoomStatus(id, statusDto.status);
  }

  @Delete(':id')
  
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Room not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Cannot delete room with occupants' 
  })
  async deleteRoom(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.roomsService.deleteRoom(id);
    return { message: 'Room deleted successfully' };
  }

  @Delete('bulk/delete')
  
  @ApiOperation({ summary: 'Delete multiple rooms' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Rooms deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Some rooms not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Cannot delete rooms with occupants' 
  })
  async bulkDeleteRooms(@Body() bulkDeleteDto: BulkDeleteRoomsDto): Promise<{ message: string }> {
    await this.roomsService.bulkDeleteRooms(bulkDeleteDto.ids);
    return { message: 'Rooms deleted successfully' };
  }

  // Additional utility endpoints

  @Get('hostel/:hostelId/floors')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get available floors for a hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Available floors retrieved successfully' 
  })
  async getHostelFloors(@Param('hostelId', ParseUUIDPipe) hostelId: string): Promise<number[]> {
    const rooms = await this.roomsService.getRoomsByHostelId(hostelId);
    const floors = [...new Set(rooms.map(room => room.floor).filter(floor => floor !== null))];
    return floors.sort((a, b) => a - b);
  }

  @Get('hostel/:hostelId/room-numbers')
  
  @ApiOperation({ summary: 'Get all room numbers for a hostel' })
  @ApiParam({ name: 'hostelId', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room numbers retrieved successfully' 
  })
  async getHostelRoomNumbers(@Param('hostelId', ParseUUIDPipe) hostelId: string): Promise<string[]> {
    const rooms = await this.roomsService.getRoomsByHostelId(hostelId);
    return rooms.map(room => room.roomNumber).sort();
  }
}