import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, UploadedFiles, UseInterceptors, Request, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
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

  @Get("fetch")
  findAll() {
    return this.hostelsService.findAll();
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
  @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string
): Promise<RoomType> {
  return this.roomsService.getRoomTypeById(hostelId, roomTypeId);
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hostelsService.findOne(id);
  }

  @Put(':id')
  // @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(FilesInterceptor('images'))
  update(
    @Param('id') id: string,
    @Body() updateHostelDto: UpdateHostelDto,
    @UploadedFiles() files: MulterFile[],
  ) {
    return this.hostelsService.update(id, updateHostelDto, files);
  }

  @Delete(':id/image')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  removeImage(
    @Param('id') id: string,
    @Body('imageUrl') imageUrl: string,
  ) {
    return this.hostelsService.removeImage(id, imageUrl);
  }

  @Delete(':id')
  @Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.hostelsService.remove(id);
  }
}