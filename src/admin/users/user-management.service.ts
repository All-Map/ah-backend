import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, In, Not, IsNull } from 'typeorm';
import { User, Gender, UserRole } from '../../entities/user.entity';
import { Booking } from '../../entities/booking.entity';
import { Hostel } from '../../entities/hostel.entity';
import { School } from '../../entities/school.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../mail/mail.service';
import * as crypto from 'crypto';

export interface UserStats {
  total: number;
  verified: number;
  unverified: number;
  students: number;
  hostel_admins: number;
  super_admins: number;
  pending_verification: number;
  with_school: number;
  without_school: number;
  active_today: number;
  growth_30d: number;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: Gender;
  is_verified: boolean;
  status: 'unverified' | 'pending' | 'verified';
  role: UserRole;
  school_id?: string;
  created_at?: Date;
  onboarding_completed: boolean;
  terms_accepted: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  emergency_contact_email?: string;
  school?: {
    id: string;
    name: string;
    domain: string;
  };
  stats?: {
    totalBookings?: number;
    activeBookings?: number;
    totalHostels?: number;
  };
}

@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Hostel)
    private readonly hostelRepository: Repository<Hostel>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    private readonly mailService: MailService,
  ) {}

  async getUsers(filterDto: UserFilterDto): Promise<{
    users: UserResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      role,
      status,
      is_verified,
      school_id,
      search,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = filterDto;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.school', 'school')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.phone',
        'user.gender',
        'user.is_verified',
        'user.status',
        'user.role',
        'user.school_id',
        'user.created_at',
        'user.onboarding_completed',
        'user.terms_accepted',
        'user.emergency_contact_name',
        'user.emergency_contact_phone',
        'user.emergency_contact_relationship',
        'user.emergency_contact_email',
        'school.id',
        'school.name',
        'school.domain',
      ]);

    // Apply filters
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (is_verified !== undefined) {
      queryBuilder.andWhere('user.is_verified = :is_verified', { is_verified });
    }

    if (school_id) {
      queryBuilder.andWhere('user.school_id = :school_id', { school_id });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    // Fetch additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return {
          ...user,
          stats,
        } as UserResponse;
      }),
    );

    return {
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOverallUserStats(): Promise<UserStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      total,
      verified,
      unverified,
      students,
      hostel_admins,
      super_admins,
      pending_verification,
      with_school,
      without_school,
      active_today,
      previous_month_total,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { is_verified: true } }),
      this.userRepository.count({ where: { is_verified: false } }),
      this.userRepository.count({ where: { role: UserRole.STUDENT } }),
      this.userRepository.count({ where: { role: UserRole.HOSTEL_ADMIN } }),
      this.userRepository.count({ where: { role: UserRole.SUPER_ADMIN } }),
      this.userRepository.count({ where: { status: 'pending' } }),
      this.userRepository.count({ where: { school_id: Not(IsNull()) } }),
      this.userRepository.count({ where: { school_id: IsNull() } }),
      this.userRepository.count({ where: { created_at: Between(today, new Date()) } }),
      this.userRepository.count({ 
        where: { created_at: Between(thirtyDaysAgo, today) } 
      }),
    ]);

    const growth_30d = previous_month_total > 0 
      ? ((active_today - previous_month_total) / previous_month_total) * 100 
      : active_today > 0 ? 100 : 0;

    return {
      total,
      verified,
      unverified,
      students,
      hostel_admins,
      super_admins,
      pending_verification,
      with_school,
      without_school,
      active_today,
      growth_30d: Math.round(growth_30d * 10) / 10,
    };
  }

  async getUserStats(userId: string) {
    const [totalBookings, activeBookings, totalHostels] = await Promise.all([
      this.bookingRepository.count({ where: { studentId: userId } }),
      this.bookingRepository.count({ 
        where: { 
          studentId: userId,
          status: In(['pending', 'confirmed', 'checked_in']) 
        } 
      }),
      this.hostelRepository.count({ where: { adminId: userId } }),
    ]);

    return {
      totalBookings,
      activeBookings,
      totalHostels,
    };
  }

  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['school'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(user.id);

    return {
      ...user,
      stats,
    } as UserResponse;
  }

//   async getUserStats(userId: string) {
//     const [totalBookings, activeBookings, totalHostels] = await Promise.all([
//       this.bookingRepository.count({ where: { studentId: userId } }),
//       this.bookingRepository.count({ 
//         where: { 
//           studentId: userId,
//           status: In(['pending', 'confirmed', 'checked_in']) 
//         } 
//       }),
//       this.hostelRepository.count({ where: { adminId: userId } }),
//     ]);

//     return {
//       totalBookings,
//       activeBookings,
//       totalHostels,
//     };
//   }

  async createUser(createUserDto: CreateUserDto): Promise<UserResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const userData = {
      ...createUserDto,
      password_hash: hashedPassword,
      verification_token: createUserDto.is_verified ? null : crypto.randomBytes(32).toString('hex'),
      verification_token_expires_at: createUserDto.is_verified ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: createUserDto.is_verified ? new Date() : null,
      status: createUserDto.is_verified ? 'verified' : 'pending',
    };

    const user = this.userRepository.create(userData as any);
    const savedUser = await this.userRepository.save(user);

    // Send verification email if not verified
    if (!createUserDto.is_verified && savedUser) {
      try {
        await this.mailService.sendVerificationEmail(
          (savedUser as any).email,
          (savedUser as any).verification_token,
        );
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }
    }

    const stats = await this.getUserStats((savedUser as any).id);

    const response: UserResponse = {
      id: (savedUser as any).id,
      name: (savedUser as any).name,
      email: (savedUser as any).email,
      phone: (savedUser as any).phone,
      gender: (savedUser as any).gender,
      is_verified: (savedUser as any).is_verified,
      status: (savedUser as any).status,
      role: (savedUser as any).role,
      school_id: (savedUser as any).school_id,
      created_at: (savedUser as any).created_at,
      onboarding_completed: (savedUser as any).onboarding_completed,
      terms_accepted: (savedUser as any).terms_accepted,
      emergency_contact_name: (savedUser as any).emergency_contact_name,
      emergency_contact_phone: (savedUser as any).emergency_contact_phone,
      emergency_contact_relationship: (savedUser as any).emergency_contact_relationship,
      emergency_contact_email: (savedUser as any).emergency_contact_email,
      stats,
    };

    return response;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    const stats = await this.getUserStats(updatedUser.id);

    return {
      ...updatedUser,
      stats,
    } as UserResponse;
  }

  async updateUserStatus(id: string, status: 'unverified' | 'pending' | 'verified'): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = status;
    user.is_verified = status === 'verified';

    if (status === 'verified' && !user.created_at) {
      user.created_at = new Date();
    }

    const updatedUser = await this.userRepository.save(user);
    const stats = await this.getUserStats(updatedUser.id);

    return {
      ...updatedUser,
      stats,
    } as UserResponse;
  }

  async verifyUser(id: string): Promise<UserResponse> {
    return this.updateUserStatus(id, 'verified');
  }

  async updateUserRole(id: string, role: UserRole): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has active bookings or hostels that might be affected
    if (user.role === UserRole.HOSTEL_ADMIN && role !== UserRole.HOSTEL_ADMIN) {
      const hasHostels = await this.hostelRepository.count({ where: { adminId: id } });
      if (hasHostels > 0) {
        throw new BadRequestException(
          'Cannot change role of user who manages hostels. Please transfer hostels first.',
        );
      }
    }

    user.role = role;
    const updatedUser = await this.userRepository.save(user);
    const stats = await this.getUserStats(updatedUser.id);

    return {
      ...updatedUser,
      stats,
    } as UserResponse;
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['school'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for active bookings
    const activeBookings = await this.bookingRepository.count({
      where: { 
        studentId: id,
        status: In(['pending', 'confirmed', 'checked_in']),
      },
    });

    if (activeBookings > 0) {
      throw new BadRequestException(
        'Cannot delete user with active bookings. Cancel bookings first.',
      );
    }

    // Check for hostels if user is a hostel admin
    if (user.role === UserRole.HOSTEL_ADMIN) {
      const hostelsCount = await this.hostelRepository.count({
        where: { adminId: id },
      });

      if (hostelsCount > 0) {
        throw new BadRequestException(
          'Cannot delete hostel admin with active hostels. Transfer hostels first.',
        );
      }
    }

    // Soft delete (update status)
    user.status = 'unverified';
    user.is_verified = false;
    await this.userRepository.save(user);

    return { message: 'User deactivated successfully' };
  }

  async sendVerificationEmail(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_verified) {
      throw new BadRequestException('User is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.verification_token = verificationToken;
    user.verification_token_expires_at = tokenExpiry;
    await this.userRepository.save(user);

    try {
      await this.mailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      throw new BadRequestException('Failed to send verification email');
    }

    return { message: 'Verification email sent successfully' };
  }

  async bulkVerifyUsers(userIds: string[]): Promise<{ verified: number; failed: string[] }> {
    const result = {
      verified: 0,
      failed: [] as string[],
    };

    for (const userId of userIds) {
      try {
        await this.verifyUser(userId);
        result.verified++;
      } catch (error) {
        result.failed.push(userId);
      }
    }

    return result;
  }

  async bulkDeleteUsers(userIds: string[]): Promise<{ deleted: number; failed: string[] }> {
    const result = {
      deleted: 0,
      failed: [] as string[],
    };

    for (const userId of userIds) {
      try {
        await this.deleteUser(userId);
        result.deleted++;
      } catch (error) {
        result.failed.push(userId);
      }
    }

    return result;
  }

  async exportUsers(filterDto: UserFilterDto): Promise<string> {
    const { users } = await this.getUsers({ ...filterDto, limit: 1000 });

    // Convert to CSV format
    const headers = [
      'ID',
      'Name',
      'Email',
      'Phone',
      'Role',
      'Status',
      'Verified',
      'School',
      'Created At',
      'Total Bookings',
      'Active Bookings',
      'Hostels Managed',
    ];

    const rows: string[][] = users.map((user) => [
      user.id,
      user.name || '',
      user.email,
      user.phone || '',
      user.role,
      user.status,
      user.is_verified ? 'Yes' : 'No',
      user.school?.name || '',
      user.created_at ? new Date(user.created_at).toISOString() : '',
      String(user.stats?.totalBookings || 0),
      String(user.stats?.activeBookings || 0),
      String(user.stats?.totalHostels || 0),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}