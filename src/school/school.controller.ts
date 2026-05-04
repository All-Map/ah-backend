import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('schools')
export class SchoolController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getSchools(@Query('search') search?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        // location is a geometry type and not directly searchable via 'contains' in standard Prisma strings
      ];
    }

    return await this.prisma.school.findMany({
      where,
      select: {
        id: true,
        name: true,
        domain: true,
        // location is omitted as it is an unsupported geography type
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  @Get(':id')
  async getSchool(@Param('id') id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        domain: true
      }
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school;
  }
}