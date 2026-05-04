import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomGender, Prisma } from '@prisma/client';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { 
  CreateRoomDto, 
  UpdateRoomDto, 
  RoomFilterDto, 
  BulkCreateRoomDto, 
  UpdateOccupancyDto 
} from './dto/rooms.dto';

const ROOM_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
} as const;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a single room
  async createRoom(createRoomDto: CreateRoomDto) {
    const { hostelId, roomTypeId, roomNumber, ...roomData } = createRoomDto;

    // Verify hostel exists
    const hostel = await this.prisma.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Verify room type exists and belongs to the hostel
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, hostelId }
    });
    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${roomTypeId} not found for this hostel`);
    }

    // Check if room number already exists in the hostel
    const existingRoom = await this.prisma.room.findFirst({
      where: { hostelId, roomNumber }
    });
    if (existingRoom) {
      throw new ConflictException(`Room number ${roomNumber} already exists in this hostel`);
    }

    return this.prisma.room.create({
      data: {
        hostelId,
        roomTypeId,
        roomNumber,
        floor: roomData.floor,
        maxOccupancy: roomData.maxOccupancy,
        notes: roomData.notes,
        currentOccupancy: 0,
        status: ROOM_STATUS.AVAILABLE,
      }
    });
  }

  async getRoomTypesByHostelId(hostelId: string) {
    return this.prisma.roomType.findMany({
      where: { hostelId },
      orderBy: { name: 'asc' }
    });
  }

  // Bulk create rooms
  async bulkCreateRooms(bulkCreateDto: BulkCreateRoomDto) {
    const { hostelId, roomTypeId, roomNumbers, ...commonData } = bulkCreateDto;

    // Verify hostel exists
    const hostel = await this.prisma.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Verify room type exists and belongs to the hostel
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, hostelId }
    });
    if (!roomType) {
      throw new NotFoundException(`Room type with ID ${roomTypeId} not found for this hostel`);
    }

    // Check for existing room numbers
    const existingRooms = await this.prisma.room.findMany({
      where: { hostelId, roomNumber: { in: roomNumbers } }
    });

    if (existingRooms.length > 0) {
      const existingNumbers = existingRooms.map(room => room.roomNumber);
      throw new ConflictException(`Room numbers already exist: ${existingNumbers.join(', ')}`);
    }

    // Create all rooms using a transaction
    return this.prisma.$transaction(
      roomNumbers.map(roomNumber =>
        this.prisma.room.create({
          data: {
            hostelId,
            roomTypeId,
            roomNumber,
            floor: commonData.floor,
            maxOccupancy: commonData.maxOccupancy,
            notes: commonData.notes,
            currentOccupancy: 0,
            status: ROOM_STATUS.AVAILABLE,
          }
        })
      )
    );
  }

  async create(createRoomTypeDto: CreateRoomTypeDto) {
    if (!createRoomTypeDto) {
      throw new BadRequestException('Request body is required');
    }

    const { hostelId, name } = createRoomTypeDto;

    // Check hostel exists
    const hostel = await this.prisma.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundException(`Hostel with ID ${hostelId} not found`);
    }

    // Check for duplicate room type name in the same hostel
    const existing = await this.prisma.roomType.findFirst({ where: { hostelId, name } });
    if (existing) {
      throw new ConflictException(`Room type "${name}" already exists in this hostel`);
    }

    // Handle allowedGenders properly
    let allowedGenders: string[] = [];
    if (createRoomTypeDto.allowedGenders && Array.isArray(createRoomTypeDto.allowedGenders)) {
      allowedGenders = createRoomTypeDto.allowedGenders;
    } else if (createRoomTypeDto.gender) {
      allowedGenders = [createRoomTypeDto.gender];
    } else {
      allowedGenders = ['mixed'];
    }

    try {
      return await this.prisma.roomType.create({
        data: {
          hostelId,
          name: createRoomTypeDto.name,
          description: createRoomTypeDto.description || null,
          pricePerSemester: createRoomTypeDto.pricePerSemester,
          pricePerMonth: createRoomTypeDto.pricePerMonth,
          pricePerWeek: createRoomTypeDto.pricePerWeek || null,
          capacity: createRoomTypeDto.capacity || 1,
          gender: (createRoomTypeDto.gender as RoomGender) || 'mixed',
          allowedGenders,
          amenities: createRoomTypeDto.amenities || [],
          images: createRoomTypeDto.images || [],
          totalRooms: createRoomTypeDto.total_rooms || createRoomTypeDto.capacity || 2,
          availableRooms: createRoomTypeDto.available_rooms || createRoomTypeDto.capacity || 2,
        }
      });
    } catch (error) {
      console.error('Error saving room type:', error);
      throw new BadRequestException('Failed to create room type: ' + error.message);
    }
  }

  async getRoomTypeById(hostelId: string, roomTypeId: string) {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, hostelId },
      include: { hostel: true }
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
      gender,
      page = 1,
      limit = 10,
      sortBy = 'roomNumber',
      sortOrder = 'asc'
    } = filterDto;

    const where: Prisma.RoomWhereInput = {};

    if (hostelId) where.hostelId = hostelId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (status) where.status = status;
    if (floor !== undefined) where.floor = floor;
    if (gender) where.roomType = { gender };

    if (available !== undefined) {
      if (available) {
        where.status = ROOM_STATUS.AVAILABLE;
        where.currentOccupancy = { lt: where.maxOccupancy as any };
      }
    }

    if (search) {
      where.OR = [
        { roomNumber: { contains: search, mode: 'insensitive' } },
        { hostel: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const offset = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        include: { hostel: true, roomType: true },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      this.prisma.room.count({ where })
    ]);

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
  async getRoomById(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { hostel: true, roomType: true }
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  // Get rooms by hostel ID
  async getRoomsByHostelId(hostelId: string, filterDto: Partial<RoomFilterDto> = {}) {
    const { status, floor, available, gender } = filterDto;

    const where: Prisma.RoomWhereInput = { hostelId };

    if (status) where.status = status;
    if (floor !== undefined) where.floor = floor;
    if (gender) where.roomType = { gender };

    let rooms = await this.prisma.room.findMany({
      where,
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' }
    });

    // Filter by availability if specified
    if (available !== undefined) {
      rooms = rooms.filter(room => {
        const isAvailable = room.status === ROOM_STATUS.AVAILABLE && room.currentOccupancy < room.maxOccupancy;
        return isAvailable === available;
      });
    }

    return rooms;
  }

  // Get available rooms by gender compatibility
  async getAvailableRoomsByGender(hostelId: string, userGender: string, roomTypeId?: string) {
    const where: Prisma.RoomWhereInput = {
      hostelId,
      status: ROOM_STATUS.AVAILABLE,
    };

    if (userGender && userGender.toLowerCase() !== 'mixed') {
      where.roomType = {
        gender: { in: [userGender.toLowerCase() as RoomGender, 'mixed'] }
      };
    }

    if (roomTypeId) where.roomTypeId = roomTypeId;

    const rooms = await this.prisma.room.findMany({
      where,
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' }
    });

    return rooms.filter(room => room.currentOccupancy < room.maxOccupancy);
  }

  // Validate gender compatibility for booking
  async validateGenderCompatibility(roomId: string, userGender: string): Promise<{ compatible: boolean; reason?: string }> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true }
    });

    if (!room) {
      return { compatible: false, reason: 'Room not found' };
    }

    if (!room.roomType) {
      return { compatible: false, reason: 'Room type not found' };
    }

    // Check if room type allows this gender
    const isCompatible = room.roomType.gender === 'mixed' || room.roomType.gender === userGender.toLowerCase();

    if (!isCompatible) {
      const genderDisplay = room.roomType.gender === 'male' ? 'Male Only'
        : room.roomType.gender === 'female' ? 'Female Only' : 'Mixed Gender';
      return {
        compatible: false,
        reason: `This room is designated for ${genderDisplay} only`
      };
    }

    // Check if room has space
    if (room.currentOccupancy >= room.maxOccupancy) {
      return { compatible: false, reason: 'Room is at full capacity' };
    }

    // Check if room is available
    if (room.status !== ROOM_STATUS.AVAILABLE) {
      return { compatible: false, reason: 'Room is not available' };
    }

    return { compatible: true };
  }

  // Update room
  async updateRoom(id: string, updateRoomDto: UpdateRoomDto) {
    const room = await this.getRoomById(id);

    // If updating room number, check for conflicts
    if (updateRoomDto.roomNumber && updateRoomDto.roomNumber !== room.roomNumber) {
      const existingRoom = await this.prisma.room.findFirst({
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

    return this.prisma.room.update({
      where: { id },
      data: {
        ...updateRoomDto,
        updatedAt: new Date(),
      },
      include: { hostel: true, roomType: true }
    });
  }

  // Update room occupancy
  async updateOccupancy(id: string, occupancyDto: UpdateOccupancyDto) {
    const room = await this.getRoomById(id);
    const { currentOccupancy } = occupancyDto;

    if (currentOccupancy < 0) {
      throw new BadRequestException('Current occupancy cannot be negative');
    }

    if (currentOccupancy > room.maxOccupancy) {
      throw new BadRequestException(`Current occupancy cannot exceed max occupancy (${room.maxOccupancy})`);
    }

    // Auto-update status based on occupancy
    let newStatus = room.status;
    if (currentOccupancy === 0 && room.status === ROOM_STATUS.OCCUPIED) {
      newStatus = ROOM_STATUS.AVAILABLE;
    } else if (currentOccupancy > 0 && room.status === ROOM_STATUS.AVAILABLE) {
      newStatus = ROOM_STATUS.OCCUPIED;
    }

    return this.prisma.room.update({
      where: { id },
      data: {
        currentOccupancy,
        status: newStatus,
        updatedAt: new Date(),
      },
      include: { hostel: true, roomType: true }
    });
  }

  // Change room status
  async changeRoomStatus(id: string, status: string) {
    const room = await this.getRoomById(id);

    if (status === ROOM_STATUS.AVAILABLE && room.currentOccupancy > 0) {
      throw new BadRequestException('Cannot set room as available while it has occupants');
    }

    return this.prisma.room.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: { hostel: true, roomType: true }
    });
  }

  // Delete room
  async deleteRoom(id: string): Promise<void> {
    const room = await this.getRoomById(id);

    if (room.currentOccupancy > 0) {
      throw new BadRequestException('Cannot delete room with current occupants');
    }

    await this.prisma.room.delete({ where: { id } });
  }

  // Bulk delete rooms
  async bulkDeleteRooms(ids: string[]): Promise<void> {
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: ids } }
    });

    if (rooms.length !== ids.length) {
      throw new NotFoundException('Some rooms were not found');
    }

    const occupiedRooms = rooms.filter(room => room.currentOccupancy > 0);
    if (occupiedRooms.length > 0) {
      const occupiedNumbers = occupiedRooms.map(room => room.roomNumber);
      throw new BadRequestException(`Cannot delete rooms with occupants: ${occupiedNumbers.join(', ')}`);
    }

    await this.prisma.room.deleteMany({ where: { id: { in: ids } } });
  }

  // Get available rooms by hostel and room type
  async getAvailableRooms(hostelId: string, roomTypeId?: string, userGender?: string) {
    const where: Prisma.RoomWhereInput = {
      hostelId,
      status: ROOM_STATUS.AVAILABLE,
    };

    if (roomTypeId) where.roomTypeId = roomTypeId;

    if (userGender && userGender.toLowerCase() !== 'mixed') {
      where.roomType = {
        gender: { in: [userGender.toLowerCase() as RoomGender, 'mixed'] }
      };
    }

    const rooms = await this.prisma.room.findMany({
      where,
      include: { roomType: true }
    });

    return rooms.filter(room => room.currentOccupancy < room.maxOccupancy);
  }

  // Get room statistics for a hostel
  async getRoomStatistics(hostelId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { hostelId },
      include: { roomType: true }
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
      byFloor: {} as Record<number, any>,
      byGender: {
        male: { count: 0, available: 0, occupied: 0, capacity: 0, currentOccupancy: 0 },
        female: { count: 0, available: 0, occupied: 0, capacity: 0, currentOccupancy: 0 },
        mixed: { count: 0, available: 0, occupied: 0, capacity: 0, currentOccupancy: 0 }
      }
    };

    rooms.forEach(room => {
      stats[room.status]++;
      stats.totalCapacity += room.maxOccupancy;
      stats.currentOccupancy += room.currentOccupancy;

      const typeName = room.roomType?.name || 'Unknown';
      if (!stats.byRoomType[typeName]) {
        stats.byRoomType[typeName] = {
          count: 0, available: 0, occupied: 0, capacity: 0, currentOccupancy: 0,
          gender: room.roomType?.gender || 'mixed'
        };
      }
      stats.byRoomType[typeName].count++;
      stats.byRoomType[typeName][room.status]++;
      stats.byRoomType[typeName].capacity += room.maxOccupancy;
      stats.byRoomType[typeName].currentOccupancy += room.currentOccupancy;

      const gender = room.roomType?.gender || 'mixed';
      if (stats.byGender[gender]) {
        stats.byGender[gender].count++;
        stats.byGender[gender][room.status]++;
        stats.byGender[gender].capacity += room.maxOccupancy;
        stats.byGender[gender].currentOccupancy += room.currentOccupancy;
      }

      if (room.floor !== null) {
        if (!stats.byFloor[room.floor]) {
          stats.byFloor[room.floor] = { count: 0, available: 0, occupied: 0, capacity: 0, currentOccupancy: 0 };
        }
        stats.byFloor[room.floor].count++;
        stats.byFloor[room.floor][room.status]++;
        stats.byFloor[room.floor].capacity += room.maxOccupancy;
        stats.byFloor[room.floor].currentOccupancy += room.currentOccupancy;
      }
    });

    stats.occupancyRate = stats.totalCapacity > 0
      ? (stats.currentOccupancy / stats.totalCapacity) * 100
      : 0;

    return stats;
  }

  // Search rooms with advanced filters
  async searchRooms(searchTerm: string, filters: RoomFilterDto = {}) {
    const where: Prisma.RoomWhereInput = {
      OR: [
        { roomNumber: { contains: searchTerm, mode: 'insensitive' } },
        { hostel: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { roomType: { name: { contains: searchTerm, mode: 'insensitive' } } }
      ]
    };

    if (filters.hostelId) where.hostelId = filters.hostelId;
    if (filters.status) where.status = filters.status;
    if (filters.gender) where.roomType = { ...where.roomType as any, gender: filters.gender };

    if (filters.available) {
      where.status = ROOM_STATUS.AVAILABLE;
    }

    return this.prisma.room.findMany({
      where,
      include: { hostel: true, roomType: true },
      orderBy: [
        { hostel: { name: 'asc' } },
        { roomNumber: 'asc' }
      ]
    });
  }

  async bulkUpdateStatus(ids: string[], status: string) {
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: ids } }
    });

    if (rooms.length !== ids.length) {
      throw new NotFoundException('Some rooms were not found');
    }

    // Check for occupancy conflicts if setting to available
    if (status === 'available') {
      const occupiedRooms = rooms.filter(room => room.currentOccupancy > 0);
      if (occupiedRooms.length > 0) {
        const occupiedNumbers = occupiedRooms.map(room => room.roomNumber);
        throw new BadRequestException(`Cannot set rooms to available while they have occupants: ${occupiedNumbers.join(', ')}`);
      }
    }

    return this.prisma.room.updateMany({
      where: { id: { in: ids } },
      data: { status, updatedAt: new Date() }
    });
  }
}
