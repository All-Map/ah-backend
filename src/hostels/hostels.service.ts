import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateHostelDto } from './dto/update-hostel.dto';
import { SerpApiService, NearbyPlace } from '../serpapi/serpapi.service';

const NEARBY_CATEGORIES = [
  { label: 'Restaurants', query: 'restaurants' },
  { label: 'Supermarkets', query: 'supermarket grocery store' },
  { label: 'Schools & Universities', query: 'university college school' },
  { label: 'Pharmacies', query: 'pharmacy chemist' },
  { label: 'Transport', query: 'bus stop trotro station' },
  { label: 'Banks & ATMs', query: 'bank ATM' },
];

@Injectable()
export class HostelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serpApi: SerpApiService,
    private cloudinary: CloudinaryService,
  ) {}

  private toPoint(lng: number, lat: number): string {
    return `POINT(${lng} ${lat})`;
  }

  async verifyOwnership(hostelId: string, userId: string): Promise<void> {
    try {
      console.log(`Verifying ownership: hostel ${hostelId} for user ${userId}`);

      const hostel = await this.prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { adminId: true, name: true }
      });

      if (!hostel) {
        throw new NotFoundException('Hostel not found');
      }

      if (hostel.adminId !== userId) {
        console.warn(`Access denied: user ${userId} tried to access hostel owned by ${hostel.adminId}`);
        throw new ForbiddenException('You do not have permission to access this hostel');
      }

      console.log(`Ownership verified: ${hostel.name} belongs to user ${userId}`);
    } catch (error) {
      console.error('Error in verifyOwnership method:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to verify ownership: ${errorMessage}`);
    }
  }

  async findByAdminId(adminId: string) {
    try {
      console.log('Fetching hostels for admin ID:', adminId);

      if (!adminId) {
        throw new BadRequestException('Admin ID is required');
      }

      const hostels = await this.prisma.hostel.findMany({
        where: { adminId },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`Found ${hostels.length} hostels for admin ${adminId}`);
      return hostels.map(h => ({
        ...h,
        base_price: h.basePrice,
        accepting_bookings: h.acceptingBookings,
        is_verified: h.isVerified,
      }));
    } catch (error) {
      console.error('Error in findByAdminId method:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to fetch hostel: ${errorMessage}`);
    }
  }

  async findOneByAdminId(hostelId: string, adminId: string) {
    try {
      console.log('Fetching hostel:', hostelId, 'for admin:', adminId);

      const hostel = await this.prisma.hostel.findFirst({
        where: { id: hostelId, adminId }
      });

      if (!hostel) {
        throw new NotFoundException('Hostel not found or you do not have permission to access it');
      }
      
      return {
        ...hostel,
        base_price: hostel.basePrice,
        accepting_bookings: hostel.acceptingBookings,
        is_verified: hostel.isVerified,
      };
    } catch (error) {
      console.error('Error in findOneByAdminId method:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to fetch hostel: ${errorMessage}`);
    }
  }

  async create(adminId: string, createHostelDto: CreateHostelDto, files?: import('multer').File[]) {
    try {
      console.log('Creating hostel with data:', { adminId });
      console.log('Location data received:', createHostelDto.location);
      console.log('Amenities data received:', createHostelDto.amenities);

      if (!adminId) {
        throw new BadRequestException('Admin ID is required');
      }

      const { location, amenities, ...dtoData } = createHostelDto;

      // Ensure location is an object and values are numbers
      let parsedLocation: any = location;
      if (typeof location === 'string') {
        try {
          parsedLocation = JSON.parse(location);
        } catch (e) {
          throw new BadRequestException('Invalid location JSON format');
        }
      }

      // Explicitly convert to numbers in case they came as strings in the object
      const lng = typeof parsedLocation?.lng === 'string' ? parseFloat(parsedLocation.lng) : parsedLocation?.lng;
      const lat = typeof parsedLocation?.lat === 'string' ? parseFloat(parsedLocation.lat) : parsedLocation?.lat;

      console.log('Parsed location coordinates:', { lng, lat });

      if (lng === undefined || lat === undefined || isNaN(lng) || isNaN(lat)) {
        throw new BadRequestException(`Invalid location data: lng=${lng}, lat=${lat}. Expected numbers.`);
      }

      // Ensure amenities is an object
      let parsedAmenities: any = amenities;
      if (typeof amenities === 'string') {
        try {
          parsedAmenities = JSON.parse(amenities);
        } catch (e) {
          throw new BadRequestException('Invalid amenities JSON format');
        }
      }

      const point = this.toPoint(lng, lat);

      // Upload images to Cloudinary
      const imageUrls: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            const url = await this.cloudinary.uploadImage(file);
            imageUrls.push(url);
          } catch (uploadError) {
            const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
            throw new BadRequestException(`Failed to upload image: ${errorMessage}`);
          }
        }
      }

      // Use raw SQL for the location geometry field
      const hostel = await this.prisma.$queryRaw`
        INSERT INTO hostels (
          name, email, phone, "SecondaryNumber", description, location, address,
          admin_id, images, amenities, base_price, payment_method,
          bank_details, momo_details, max_occupancy, house_rules,
          nearby_facilities, check_in_time, check_out_time,
          is_verified, is_active, accepting_bookings, rating, total_reviews
        ) VALUES (
          ${dtoData.name}, ${dtoData.email}, ${dtoData.phone}, ${dtoData.SecondaryNumber},
          ${dtoData.description}, ST_GeomFromText(${point}, 4326), ${dtoData.address},
          ${adminId}, ${JSON.stringify(imageUrls)}::jsonb, ${JSON.stringify(parsedAmenities)}::jsonb,
          ${dtoData.base_price}, ${dtoData.payment_method || 'both'}::hostels_payment_method_enum,
          ${dtoData.bank_details ? JSON.stringify(dtoData.bank_details) : null}::jsonb,
          ${dtoData.momo_details ? JSON.stringify(dtoData.momo_details) : null}::jsonb,
          ${dtoData.max_occupancy || 0}, ${dtoData.house_rules || ''},
          ${JSON.stringify(dtoData.nearby_facilities || [])}::jsonb,
          ${dtoData.check_in_time || null}::time, ${dtoData.check_out_time || null}::time,
          false, true, true, 0, 0
        ) RETURNING id, name, email, phone, "SecondaryNumber", description, address, admin_id, images, amenities, base_price, payment_method, bank_details, momo_details, max_occupancy, house_rules, nearby_facilities, check_in_time, check_out_time, is_verified, is_active, accepting_bookings, rating, total_reviews, created_at, updated_at, ST_AsText(location) as location
      `;

      console.log('Successfully created hostel');
      return Array.isArray(hostel) ? hostel[0] : hostel;
    } catch (error) {
      console.error('Error in create method:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to create hostel: ${errorMessage}`);
    }
  }

  async findPublicHostels() {
    const hostels = await this.prisma.hostel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        images: true,
        amenities: true,
        rating: true,
        totalReviews: true,
        basePrice: true,
        acceptingBookings: true,
        isVerified: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch locations separately via raw SQL for geometry support
    const hostelIds = hostels.map(h => h.id);
    if (hostelIds.length > 0) {
      const locations: any[] = await this.prisma.$queryRaw`
        SELECT id, ST_AsText(location) as location FROM hostels WHERE id = ANY(${hostelIds}::uuid[])
      `;
      const locationMap = new Map(locations.map(l => [l.id, l.location]));
      return hostels.map(h => ({ 
        ...h, 
        base_price: h.basePrice,
        accepting_bookings: h.acceptingBookings,
        is_verified: h.isVerified,
        location: locationMap.get(h.id) || null 
      }));
    }

    return hostels.map(h => ({
      ...h,
      base_price: h.basePrice,
      accepting_bookings: h.acceptingBookings,
      is_verified: h.isVerified,
    }));
  }

  async findPublicHostelById(id: string) {
    const hostel = await this.prisma.hostel.findFirst({
      where: { id, isActive: true },
      select: {
        id: true, name: true, description: true, address: true,
        images: true, amenities: true, basePrice: true, paymentMethod: true,
        bankDetails: true, momoDetails: true, maxOccupancy: true,
        houseRules: true, nearbyFacilities: true, checkInTime: true,
        checkOutTime: true, rating: true, totalReviews: true,
        acceptingBookings: true, isVerified: true,
      }
    });

    if (!hostel) {
      throw new NotFoundException('Hostel not found');
    }

    // Fetch location via raw SQL
    const locations: any[] = await this.prisma.$queryRaw`
      SELECT ST_AsText(location) as location FROM hostels WHERE id = ${id}::uuid
    `;

    return { 
      ...hostel, 
      base_price: hostel.basePrice,
      accepting_bookings: hostel.acceptingBookings,
      is_verified: hostel.isVerified,
      location: locations[0]?.location || null 
    };
  }

  async findAll() {
    try {
      const hostels = await this.prisma.hostel.findMany({
        orderBy: { createdAt: 'desc' }
      });

      // Fetch locations via raw SQL (geometry columns can't be read by Prisma)
      const hostelIds = hostels.map(h => h.id);
      let locationMap = new Map<string, string>();
      if (hostelIds.length > 0) {
        const locations: any[] = await this.prisma.$queryRaw`
          SELECT id, ST_AsText(location) as location FROM hostels WHERE id = ANY(${hostelIds}::uuid[])
        `;
        locationMap = new Map(locations.map(l => [l.id, l.location]));
      }
      
      return hostels.map(h => ({
        ...h,
        base_price: h.basePrice,
        accepting_bookings: h.acceptingBookings,
        is_verified: h.isVerified,
        location: locationMap.get(h.id) || null,
      }));
    } catch (error) {
      console.error('Error in findAll method:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const hostel = await this.prisma.hostel.findUnique({ where: { id } });

      if (!hostel) {
        throw new NotFoundException('Hostel not found');
      }

      return {
        ...hostel,
        base_price: hostel.basePrice,
        accepting_bookings: hostel.acceptingBookings,
        is_verified: hostel.isVerified,
      };
    } catch (error) {
      console.error('Error in findOne method:', error);
      throw error;
    }
  }

  async toggleBookingStatus(id: string, acceptingBookings: boolean) {
    try {
      const hostel = await this.prisma.hostel.update({
        where: { id },
        data: {
          acceptingBookings,
          updatedAt: new Date()
        },
        select: { id: true, name: true, acceptingBookings: true }
      });

      return {
        message: `Hostel ${hostel.name} is now ${acceptingBookings ? 'accepting' : 'not accepting'} bookings`,
        hostel
      };
    } catch (error) {
      console.error('Error in toggleBookingStatus method:', error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Hostel not found');
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to toggle booking status: ${errorMessage}`);
    }
  }

  async update(id: string, updateHostelDto: UpdateHostelDto, files?: import('multer').File[]) {
    try {
      const existingHostel = await this.findOne(id);
      let imageUpdates: string[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          try {
            const url = await this.cloudinary.uploadImage(file);
            imageUpdates.push(url);
          } catch (uploadError) {
            const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
            throw new BadRequestException(`Failed to upload image: ${errorMessage}`);
          }
        }
      }

      // Parse and validate location if provided
      let locationSql = false;
      let point = '';
      if (updateHostelDto.location) {
        let parsedLocation;
        if (typeof updateHostelDto.location === 'string') {
          try {
            parsedLocation = JSON.parse(updateHostelDto.location);
          } catch (parseError) {
            throw new BadRequestException('Invalid location JSON format');
          }
        } else {
          parsedLocation = updateHostelDto.location;
        }

        if (!parsedLocation ||
          typeof parsedLocation.lng !== 'number' ||
          typeof parsedLocation.lat !== 'number' ||
          isNaN(parsedLocation.lng) ||
          isNaN(parsedLocation.lat)) {
          throw new BadRequestException(`Invalid location data provided.`);
        }

        point = this.toPoint(parsedLocation.lng, parsedLocation.lat);
        locationSql = true;
      }

      // Parse amenities if provided
      let parsedAmenities;
      if (updateHostelDto.amenities) {
        if (typeof updateHostelDto.amenities === 'string') {
          try {
            parsedAmenities = JSON.parse(updateHostelDto.amenities);
          } catch (parseError) {
            throw new BadRequestException('Invalid amenities JSON format');
          }
        } else {
          parsedAmenities = updateHostelDto.amenities;
        }
      }

      const { location, amenities, ...restOfDto } = updateHostelDto;

      // Build the update data
      const updateData: any = {
        ...restOfDto,
        images: [...((existingHostel.images as any[]) || []), ...imageUpdates],
        updatedAt: new Date(),
      };

      if (parsedAmenities) updateData.amenities = parsedAmenities;

      // If location needs updating, use raw SQL for geometry
      if (locationSql) {
        await this.prisma.$executeRaw`
          UPDATE hostels SET location = ST_GeomFromText(${point}, 4326) WHERE id = ${id}::uuid
        `;
      }

      const hostel = await this.prisma.hostel.update({
        where: { id },
        data: updateData,
      });

      return hostel;
    } catch (error) {
      console.error('Error in update method:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to update hostel: ${errorMessage}`);
    }
  }

  async getRoomTypesByHostelId(hostelId: string) {
    return this.prisma.roomType.findMany({
      where: { hostelId },
      orderBy: { name: 'asc' }
    });
  }

  async getRoomTypeByIdStudent(hostelId: string, roomTypeId: string) {
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

  async getRoomTypesByHostelIdStudent(hostelId: string) {
    return this.getRoomTypesByHostelId(hostelId);
  }

  async getHostelContact(id: string) {
    try {
      const hostel = await this.prisma.hostel.findUnique({
        where: { id },
        select: {
          name: true, phone: true, email: true, secondaryNumber: true, adminId: true,
        }
      });

      if (!hostel) {
        throw new NotFoundException('Hostel not found');
      }

      return {
        phone: hostel.phone,
        email: hostel.email,
        secondaryPhone: hostel.secondaryNumber,
      };
    } catch (error) {
      console.error('Error in getHostelContact method:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to fetch contact details: ${errorMessage}`);
    }
  }

  async removeImage(id: string, imageUrl: string) {
    try {
      const hostel = await this.findOne(id);
      const publicId = this.cloudinary.extractPublicId(imageUrl);

      if (!publicId) {
        throw new BadRequestException('Invalid image URL');
      }

      await this.cloudinary.deleteImage(publicId);

      const updatedImages = ((hostel.images as any[]) || []).filter(img => img !== imageUrl);

      return this.prisma.hostel.update({
        where: { id },
        data: { images: updatedImages },
        select: { images: true }
      });
    } catch (error) {
      console.error('Error in removeImage method:', error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const hostel = await this.findOne(id);

      for (const imageUrl of (hostel.images as any[]) || []) {
        const publicId = this.cloudinary.extractPublicId(imageUrl);
        if (publicId) {
          try {
            await this.cloudinary.deleteImage(publicId);
          } catch (deleteError) {
            console.error('Failed to delete image from Cloudinary:', deleteError);
          }
        }
      }

      await this.prisma.hostel.delete({ where: { id } });

      return { message: 'Hostel deleted successfully' };
    } catch (error) {
      console.error('Error in remove method:', error);
      throw error;
    }
  }

  async findNearbyPlaces(
    hostelId: string,
    category?: string,
  ): Promise<{ category: string; places: NearbyPlace[] }[]> {
    const locations: any[] = await this.prisma.$queryRaw`
      SELECT ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
      FROM hostels WHERE id = ${hostelId}::uuid
    `;

    if (!locations[0]?.lat || !locations[0]?.lng) {
      return [];
    }

    const { lat, lng } = locations[0];

    const categories = category
      ? NEARBY_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))
      : NEARBY_CATEGORIES;

    const results = await Promise.all(
      categories.map(async cat => ({
        category: cat.label,
        places: await this.serpApi.searchNearbyPlaces(lat, lng, cat.query),
      })),
    );

    return results.filter(r => r.places.length > 0);
  }
}