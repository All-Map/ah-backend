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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { UserManagementService } from './user-management.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserManagementController {
  constructor(private readonly userService: UserManagementService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async getUsers(@Query() filterDto: UserFilterDto) {
    return await this.userService.getUsers(filterDto);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User statistics retrieved successfully',
  })
  async getUserStats() {
    return await this.userService.getOverallUserStats();
  }

  @Get('export')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export users to CSV' })
  async exportUsers(@Query() filterDto: UserFilterDto) {
    return await this.userService.exportUsers(filterDto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.userService.createUser(createUserDto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user details' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.updateUser(id, updateUserDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user status' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User status updated successfully',
  })
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'unverified' | 'pending' | 'verified',
  ) {
    return await this.userService.updateUserStatus(id, status);
  }

  @Patch(':id/verify')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Verify a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User verified successfully',
  })
  async verifyUser(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.verifyUser(id);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User role updated successfully',
  })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: UserRole,
  ) {
    return await this.userService.updateUserRole(id, role);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete user with active bookings or hostels',
  })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.deleteUser(id);
  }

  @Post(':id/send-verification')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send verification email to user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification email sent successfully',
  })
  async sendVerificationEmail(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.sendVerificationEmail(id);
  }

  @Post('bulk-verify')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bulk verify users' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users verified successfully',
  })
  async bulkVerifyUsers(@Body('userIds') userIds: string[]) {
    return await this.userService.bulkVerifyUsers(userIds);
  }

  @Post('bulk-delete')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bulk delete users' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users deleted successfully',
  })
  async bulkDeleteUsers(@Body('userIds') userIds: string[]) {
    return await this.userService.bulkDeleteUsers(userIds);
  }
}