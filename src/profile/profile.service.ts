import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface School {
  id: string;
  name: string;
  domain: string;
  location?: any;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_verified: boolean;
  role: string;
  school_id: string | null;
  school: School | null;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserProfile(userId: string): Promise<any> {
    // Step 1: Get user data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isVerified: true,
        role: true,
        schoolId: true
      }
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Step 2: Get school data if available
    let school: School | null = null;
    if (user.schoolId) {
      const schoolData = await this.prisma.school.findUnique({
        where: { id: user.schoolId },
        select: {
          id: true,
          name: true,
          domain: true
          // location is omitted because it is a geography type not fully supported in standard Prisma select
        }
      });

      if (schoolData) {
        school = {
          id: schoolData.id,
          name: schoolData.name,
          domain: schoolData.domain
        };
      }
    }

    // Step 3: Return combined profile
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      is_verified: user.isVerified,
      role: user.role,
      school_id: user.schoolId,
      school,
    };
  }
}