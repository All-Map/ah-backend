import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, UploadedFiles, UseInterceptors, Request, HttpStatus, ParseUUIDPipe, Patch } from '@nestjs/common';
import { HostelsService } from './hostels.service';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { UserRole } from '../entities/user.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UpdateHostelDto } from './dto/update-hostel.dto';
import { File as MulterFile } from 'multer';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { RoomType } from 'src/entities/room-type.entity';
import { RoomsService } from 'src/rooms/rooms.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('hostels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HostelsController {
  constructor(private readonly hostelsService: HostelsService, private readonly roomsService: RoomsService) {}

  @Post('create')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(FilesInterceptor('images'))
  create(
    @Request() req: any,
    @Body() createHostelDto: CreateHostelDto,
    @UploadedFiles() files: MulterFile[],
  ) {
    console.log('Request user:', req.user);
    console.log('CreateHostelDto adminId:', createHostelDto.adminId);
    
    // Extract admin ID from JWT token in request or from DTO
    const adminId = createHostelDto.adminId || req.user?.id || req.user?.sub;
    
    if (!adminId) {
      throw new Error('Unable to determine admin ID from request');
    }
    
    return this.hostelsService.create(
      adminId, 
      createHostelDto, 
      files
    );
  }

  // Updated: Fetch hostels for the current user only
  @Get("fetch")
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  findAll(@CurrentUser() user: any) {
    const userId = user.id || user.sub;
    
    // Super admins can see all hostels, hostel admins see only their own
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.hostelsService.findAll();
    } else {
      return this.hostelsService.findByAdminId(userId);
    }
  }

  // Optional: Add a separate endpoint for super admins to get all hostels
  @Get("all")
  // @Roles(UserRole.SUPER_ADMIN)
  findAllHostels() {
    return this.hostelsService.findAll();
  }

  // Optional: Add endpoint to get hostels for a specific admin (super admin only)
  @Get("admin/:adminId")
  @Roles(UserRole.SUPER_ADMIN)
  findHostelsByAdmin(@Param('adminId') adminId: string) {
    return this.hostelsService.findByAdminId(adminId);
  }

  @Patch(':id/booking-status')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle hostel booking availability' })
  @ApiParam({ name: 'id', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Booking status updated successfully' 
  })
  async toggleBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('acceptingBookings') acceptingBookings: boolean,
    @CurrentUser() user: any
  ) {
    // Ensure user can only modify their own hostels (unless super admin)
    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.hostelsService.verifyOwnership(id, user.id || user.sub);
    }
    
    return this.hostelsService.toggleBookingStatus(id, acceptingBookings);
  }

  @Get(':id/room-types')
  @ApiOperation({ summary: 'Get room types for a hostel' })
  @ApiParam({ name: 'id', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room types retrieved successfully',
    type: [RoomType] 
  })
  async getRoomTypesByHostelId(
    @Param('id', ParseUUIDPipe) hostelId: string,
    @CurrentUser() user: any
  ): Promise<RoomType[]> {
    // Ensure user can only access their own hostel data (unless super admin)
    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.hostelsService.verifyOwnership(hostelId, user.id || user.sub);
    }
    
    return this.hostelsService.getRoomTypesByHostelId(hostelId);
  }

    @Get('students/:id/room-types')
  @ApiOperation({ summary: 'Get room types for a hostel' })
  @ApiParam({ name: 'id', description: 'Hostel ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room types retrieved successfully',
    type: [RoomType] 
  })
  async getRoomTypesByHostelIdStudent(
    @Param('id', ParseUUIDPipe) hostelId: string
  ): Promise<RoomType[]> {
    return this.hostelsService.getRoomTypesByHostelId(hostelId);
  }

  @Get(':id/room-types/:roomTypeId')
  @ApiOperation({ summary: 'Get room type details by ID' })
  @ApiParam({ name: 'id', description: 'Hostel ID' })
  @ApiParam({ name: 'roomTypeId', description: 'Room Type ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Room type details retrieved successfully',
    type: RoomType 
  })
  async getRoomTypeById(
    @Param('id', ParseUUIDPipe) hostelId: string,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
    @CurrentUser() user: any
  ): Promise<RoomType> {
    // Ensure user can only access their own hostel data (unless super admin)
    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.hostelsService.verifyOwnership(hostelId, user.id || user.sub);
    }
    
    return this.roomsService.getRoomTypeById(hostelId, roomTypeId);
  }

  @Get(':id/room-types/:roomTypeId')
@ApiOperation({ summary: 'Get room type details by ID' })
@ApiParam({ name: 'id', description: 'Hostel ID' })
@ApiParam({ name: 'roomTypeId', description: 'Room Type ID' })
@ApiResponse({ 
  status: HttpStatus.OK, 
  description: 'Room type details retrieved successfully',
  type: RoomType 
})
async getRoomTypeByIdStudent(
  @Param('id', ParseUUIDPipe) hostelId: string,
  @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string
): Promise<RoomType> {
  return this.roomsService.getRoomTypeById(hostelId, roomTypeId);
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hostelsService.findOne(id);
  }


  @Put(':id')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(FilesInterceptor('images'))
  async update(
    @Param('id') id: string,
    @Body() updateHostelDto: UpdateHostelDto,
    @UploadedFiles() files: MulterFile[],
    @CurrentUser() user: any
  ) {
    // Ensure user can only update their own hostels (unless super admin)
    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.hostelsService.verifyOwnership(id, user.id || user.sub);
    }
    
    return this.hostelsService.update(id, updateHostelDto, files);
  }

  @Delete(':id/image')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  removeImage(
    @Param('id') id: string,
    @Body('imageUrl') imageUrl: string,
    @CurrentUser() user: any
  ) {
    // Ensure user can only modify their own hostels (unless super admin)
    if (user.role !== UserRole.SUPER_ADMIN) {
      this.hostelsService.verifyOwnership(id, user.id || user.sub);
    }
    
    return this.hostelsService.removeImage(id, imageUrl);
  }

  @Delete(':id')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any
  ) {
    // Ensure user can only delete their own hostels (unless super admin)
    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.hostelsService.verifyOwnership(id, user.id || user.sub);
    }
    
    return this.hostelsService.remove(id);
  }
}