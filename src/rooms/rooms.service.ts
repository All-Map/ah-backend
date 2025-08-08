import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like, In } from 'typeorm';
import { Room, RoomStatus } from '../entities/room.entity';
import { Hostel } from '../entities/hostel.entity';
import { RoomType } from '../entities/room-type.entity';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';

// DTOs
export class CreateRoomDto {
  hostelId: string;
  roomTypeId: string;
  roomNumber: string;
  floor?: number;
  maxOccupancy: number;
  notes?: string;
}

export class UpdateRoomDto {
  roomNumber?: string;
  floor?: number;
  status?: RoomStatus;
  maxOccupancy?: number;
  notes?: string;
}

export class RoomFilterDto {
  hostelId?: string;
  roomTypeId?: string;
  status?: RoomStatus;
  floor?: number;
  available?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'roomNumber' | 'floor' | 'status' | 'currentOccupancy' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

export class BulkCreateRoomDto {
  hostelId: string;
  roomTypeId: string;
  floor?: number;
  maxOccupancy: number;
  roomNumbers: string[];
  notes?: string;
}

export class UpdateOccupancyDto {
  currentOccupancy: number;
}

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Hostel)
    private readonly hostelRepository: Repository<Hostel>,
    @InjectRepository(RoomType)
    private readonly roomTypeRepository: Repository<RoomType>,
  ) {}

  // Create a single room
  async createRoom(createRoomDto: CreateRoomDto): Promise<Room> {
    const { hostelId, roomTypeId, roomNumber, ...roomData } = createRoomDto;

    // Verify hostel exists
    const hostel = await this.hostelRepository.findOne({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Verify room type exists and belongs to the hostel
    const roomType = await this.roomTypeRepository.findOne({
      where: { id: roomTypeId, hostelId }
    });
    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${roomTypeId} not found for this hostel`);
    }

    // Check if room number already exists in the hostel
    const existingRoom = await this.roomRepository.findOne({
      where: { hostelId, roomNumber }
    });
    if (existingRoom) {
      throw new ConflictException(`Room number ${roomNumber} already exists in this hostel`);
    }

    // Create the room
    const room = this.roomRepository.create({
      hostelId,
      roomTypeId,
      roomNumber,
      ...roomData,
      currentOccupancy: 0,
      status: RoomStatus.AVAILABLE
    });

    return await this.roomRepository.save(room);
  }

  async getRoomTypesByHostelId(hostelId: string): Promise<RoomType[]> {
  return this.roomTypeRepository.find({
    where: { hostelId },
    order: { name: 'ASC' }
  });
}

  // Bulk create rooms
  async bulkCreateRooms(bulkCreateDto: BulkCreateRoomDto): Promise<Room[]> {
    const { hostelId, roomTypeId, roomNumbers, ...commonData } = bulkCreateDto;

    // Verify hostel exists
    const hostel = await this.hostelRepository.findOne({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Verify room type exists and belongs to the hostel
    const roomType = await this.roomTypeRepository.findOne({
      where: { id: roomTypeId, hostelId }
    });
    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${roomTypeId} not found for this hostel`);
    }

    // Check for existing room numbers
    const existingRooms = await this.roomRepository.find({
      where: { hostelId, roomNumber: In(roomNumbers) }
    });
    
    if (existingRooms.length > 0) {
      const existingNumbers = existingRooms.map(room => room.roomNumber);
      throw new ConflictException(`Room numbers already exist: ${existingNumbers.join(', ')}`);
    }

    // Create all rooms
    const rooms = roomNumbers.map(roomNumber => 
      this.roomRepository.create({
        hostelId,
        roomTypeId,
        roomNumber,
        ...commonData,
        currentOccupancy: 0,
        status: RoomStatus.AVAILABLE
      })
    );

    return await this.roomRepository.save(rooms);
  }

async create(createRoomTypeDto: CreateRoomTypeDto): Promise<RoomType> {
  // Validate input
  if (!createRoomTypeDto) {
    throw new BadRequestException('Request body is required');
  }

  const { hostelId, name } = createRoomTypeDto;

  // Check hostel exists
  const hostel = await this.hostelRepository.findOneBy({ id: hostelId });
  if (!hostel) {
    throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
  }

  // Check for duplicate
  const existing = await this.roomTypeRepository.findOneBy({ hostelId, name });
  if (existing) {
    throw new ConflictException(`Room type "${name}" already exists in this hostel`);
  }

  // Create with default values
  const roomType = this.roomTypeRepository.create({
    ...createRoomTypeDto,
    amenities: createRoomTypeDto.amenities || [],
    images: createRoomTypeDto.images || [],
    totalRooms: createRoomTypeDto.capacity || 2,
    availableRooms: createRoomTypeDto.capacity || 2
  });

  return this.roomTypeRepository.save(roomType);
}

async getRoomTypeById(hostelId: string, roomTypeId: string): Promise<RoomType> {
  const roomType = await this.roomTypeRepository.findOne({
    where: { id: roomTypeId, hostelId },
    relations: ['hostel']
  });

  if (!roomType) {
    throw new NotFoundException(
      `Room type with ID ${roomTypeId} not found in hostel ${hostelId}`
    );
  }
  return roomType;
}

  // Get all rooms with filtering and pagination
  async getRooms(filterDto: RoomFilterDto = {}) {
    const {
      hostelId,
      roomTypeId,
      status,
      floor,
      available,
      search,
      page = 1,
      limit = 10,
      sortBy = 'roomNumber',
      sortOrder = 'ASC'
    } = filterDto;

    const queryBuilder = this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.hostel', 'hostel')
      .leftJoinAndSelect('room.roomType', 'roomType');

    // Apply filters
    if (hostelId) {
      queryBuilder.andWhere('room.hostelId = :hostelId', { hostelId });
    }

    if (roomTypeId) {
      queryBuilder.andWhere('room.roomTypeId = :roomTypeId', { roomTypeId });
    }

    if (status) {
      queryBuilder.andWhere('room.status = :status', { status });
    }

    if (floor !== undefined) {
      queryBuilder.andWhere('room.floor = :floor', { floor });
    }

    if (available !== undefined) {
      if (available) {
        queryBuilder.andWhere('room.status = :availableStatus', { availableStatus: RoomStatus.AVAILABLE })
                   .andWhere('room.currentOccupancy < room.maxOccupancy');
      } else {
        queryBuilder.andWhere('room.currentOccupancy >= room.maxOccupancy OR room.status != :availableStatus', 
                              { availableStatus: RoomStatus.AVAILABLE });
      }
    }

    if (search) {
      queryBuilder.andWhere('(room.roomNumber ILIKE :search OR hostel.name ILIKE :search)', 
                           { search: `%${search}%` });
    }

    // Apply sorting
    queryBuilder.orderBy(`room.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [rooms, total] = await queryBuilder.getManyAndCount();

    return {
      rooms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get room by ID
  async getRoomById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['hostel', 'roomType']
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  // Get rooms by hostel ID
  async getRoomsByHostelId(hostelId: string, filterDto: Partial<RoomFilterDto> = {}): Promise<Room[]> {
    const { status, floor, available } = filterDto;

    const where: any = { hostelId };

    if (status) where.status = status;
    if (floor !== undefined) where.floor = floor;

    let rooms = await this.roomRepository.find({
      where,
      relations: ['roomType'],
      order: { roomNumber: 'ASC' }
    });

    // Filter by availability if specified
    if (available !== undefined) {
      rooms = rooms.filter(room => room.isAvailable() === available);
    }

    return rooms;
  }

  // Update room
  async updateRoom(id: string, updateRoomDto: UpdateRoomDto): Promise<Room> {
    const room = await this.getRoomById(id);

    // If updating room number, check for conflicts
    if (updateRoomDto.roomNumber && updateRoomDto.roomNumber !== room.roomNumber) {
      const existingRoom = await this.roomRepository.findOne({
        where: { 
          hostelId: room.hostelId, 
          roomNumber: updateRoomDto.roomNumber 
        }
      });
      
      if (existingRoom) {
        throw new ConflictException(`Room number ${updateRoomDto.roomNumber} already exists in this hostel`);
      }
    }

    // Validate occupancy if maxOccupancy is being updated
    if (updateRoomDto.maxOccupancy !== undefined && updateRoomDto.maxOccupancy < room.currentOccupancy) {
      throw new BadRequestException(`Max occupancy cannot be less than current occupancy (${room.currentOccupancy})`);
    }

    Object.assign(room, updateRoomDto);
    return await this.roomRepository.save(room);
  }

  // Update room occupancy
  async updateOccupancy(id: string, occupancyDto: UpdateOccupancyDto): Promise<Room> {
    const room = await this.getRoomById(id);
    const { currentOccupancy } = occupancyDto;

    if (currentOccupancy < 0) {
      throw new BadRequestException('Current occupancy cannot be negative');
    }

    if (currentOccupancy > room.maxOccupancy) {
      throw new BadRequestException(`Current occupancy cannot exceed max occupancy (${room.maxOccupancy})`);
    }

    room.currentOccupancy = currentOccupancy;

    // Auto-update status based on occupancy
    if (currentOccupancy === 0 && room.status === RoomStatus.OCCUPIED) {
      room.status = RoomStatus.AVAILABLE;
    } else if (currentOccupancy > 0 && room.status === RoomStatus.AVAILABLE) {
      room.status = RoomStatus.OCCUPIED;
    }

    return await this.roomRepository.save(room);
  }

  // Change room status
  async changeRoomStatus(id: string, status: RoomStatus): Promise<Room> {
    const room = await this.getRoomById(id);

    // Validate status change
    if (status === RoomStatus.AVAILABLE && room.currentOccupancy > 0) {
      throw new BadRequestException('Cannot set room as available while it has occupants');
    }

    room.status = status;
    return await this.roomRepository.save(room);
  }

  // Delete room
  async deleteRoom(id: string): Promise<void> {
    const room = await this.getRoomById(id);

    if (room.currentOccupancy > 0) {
      throw new BadRequestException('Cannot delete room with current occupants');
    }

    await this.roomRepository.remove(room);
  }

  // Bulk delete rooms
  async bulkDeleteRooms(ids: string[]): Promise<void> {
    const rooms = await this.roomRepository.find({
      where: { id: In(ids) }
    });

    if (rooms.length !== ids.length) {
      throw new NotFoundException('Some rooms were not found');
    }

    const occupiedRooms = rooms.filter(room => room.currentOccupancy > 0);
    if (occupiedRooms.length > 0) {
      const occupiedNumbers = occupiedRooms.map(room => room.roomNumber);
      throw new BadRequestException(`Cannot delete rooms with occupants: ${occupiedNumbers.join(', ')}`);
    }

    await this.roomRepository.remove(rooms);
  }

  // Get available rooms by hostel and room type
  async getAvailableRooms(hostelId: string, roomTypeId?: string): Promise<Room[]> {
    const where: any = {
      hostelId,
      status: RoomStatus.AVAILABLE
    };

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    const rooms = await this.roomRepository.find({
      where,
      relations: ['roomType']
    });

    return rooms.filter(room => room.hasSpace());
  }

  // Get room statistics for a hostel
  async getRoomStatistics(hostelId: string) {
    const rooms = await this.roomRepository.find({
      where: { hostelId },
      relations: ['roomType']
    });

    const stats = {
      total: rooms.length,
      available: 0,
      occupied: 0,
      maintenance: 0,
      reserved: 0,
      totalCapacity: 0,
      currentOccupancy: 0,
      occupancyRate: 0,
      byRoomType: {} as Record<string, any>,
      byFloor: {} as Record<number, any>
    };

    rooms.forEach(room => {
      // Status counts
      stats[room.status]++;
      
      // Capacity and occupancy
      stats.totalCapacity += room.maxOccupancy;
      stats.currentOccupancy += room.currentOccupancy;

      // By room type
      const typeName = room.roomType?.name || 'Unknown';
      if (!stats.byRoomType[typeName]) {
        stats.byRoomType[typeName] = {
          count: 0,
          available: 0,
          occupied: 0,
          capacity: 0,
          currentOccupancy: 0
        };
      }
      stats.byRoomType[typeName].count++;
      stats.byRoomType[typeName][room.status]++;
      stats.byRoomType[typeName].capacity += room.maxOccupancy;
      stats.byRoomType[typeName].currentOccupancy += room.currentOccupancy;

      // By floor
      if (room.floor !== null) {
        if (!stats.byFloor[room.floor]) {
          stats.byFloor[room.floor] = {
            count: 0,
            available: 0,
            occupied: 0,
            capacity: 0,
            currentOccupancy: 0
          };
        }
        stats.byFloor[room.floor].count++;
        stats.byFloor[room.floor][room.status]++;
        stats.byFloor[room.floor].capacity += room.maxOccupancy;
        stats.byFloor[room.floor].currentOccupancy += room.currentOccupancy;
      }
    });

    // Calculate occupancy rate
    stats.occupancyRate = stats.totalCapacity > 0 
      ? (stats.currentOccupancy / stats.totalCapacity) * 100 
      : 0;

    return stats;
  }

  // Search rooms with advanced filters
  async searchRooms(searchTerm: string, filters: RoomFilterDto = {}) {
    const queryBuilder = this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.hostel', 'hostel')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .where('(room.roomNumber ILIKE :search OR hostel.name ILIKE :search OR roomType.name ILIKE :search)', 
             { search: `%${searchTerm}%` });

    // Apply additional filters
    if (filters.hostelId) {
      queryBuilder.andWhere('room.hostelId = :hostelId', { hostelId: filters.hostelId });
    }

    if (filters.status) {
      queryBuilder.andWhere('room.status = :status', { status: filters.status });
    }

    if (filters.available) {
      queryBuilder.andWhere('room.status = :availableStatus', { availableStatus: RoomStatus.AVAILABLE })
                   .andWhere('room.currentOccupancy < room.maxOccupancy');
    }

    const rooms = await queryBuilder
      .orderBy('hostel.name', 'ASC')
      .addOrderBy('room.roomNumber', 'ASC')
      .getMany();

    return rooms;
  }
}