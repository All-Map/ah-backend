import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateHostelDto } from './dto/update-hostel.dto';
import { RoomType } from 'src/entities/room-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomsService } from 'src/rooms/rooms.service';

@Injectable()
export class HostelsService {
  constructor(
    private supabase: SupabaseService,
    private cloudinary: CloudinaryService,
    private roomsService: RoomsService, 
    @InjectRepository(RoomType)
    private readonly roomTypeRepository: Repository<RoomType>,
  ) {}

  private toPoint(lng: number, lat: number): string {
    return `POINT(${lng} ${lat})`;
  }

  // New method: Verify hostel ownership
  async verifyOwnership(hostelId: string, userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('hostels')
        .select('admin_id')
        .eq('id', hostelId)
        .single();

      if (error) {
        console.error('Supabase verifyOwnership error:', error);
        throw new NotFoundException('Hostel not found');
      }

      if (data.admin_id !== userId) {
        throw new ForbiddenException('You do not have permission to access this hostel');
      }
    } catch (error) {
      console.error('Error in verifyOwnership method:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to verify ownership: ${error.message}`);
    }
  }

  // New method: Find hostels by admin ID
  async findByAdminId(adminId: string) {
    try {
      console.log('Fetching hostels for admin ID:', adminId);
      
      const { data, error } = await this.supabase.client
        .from('hostels')
        .select('*')
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase findByAdminId error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }
      
      console.log(`Found ${data?.length || 0} hostels for admin ${adminId}`);
      return data || [];
    } catch (error) {
      console.error('Error in findByAdminId method:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch hostels: ${error.message}`);
    }
  }

  // New method: Find one hostel by ID and admin ID
  async findOneByAdminId(hostelId: string, adminId: string) {
    try {
      console.log('Fetching hostel:', hostelId, 'for admin:', adminId);
      
      const { data, error } = await this.supabase.client
        .from('hostels')
        .select('*')
        .eq('id', hostelId)
        .eq('admin_id', adminId)
        .single();

      if (error) {
        console.error('Supabase findOneByAdminId error:', error);
        throw new NotFoundException('Hostel not found or you do not have permission to access it');
      }
      
      return data;
    } catch (error) {
      console.error('Error in findOneByAdminId method:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch hostel: ${error.message}`);
    }
  }

  async create(adminId: string, createHostelDto: CreateHostelDto, files?: import('multer').File[]) {
    try {
      console.log('Creating hostel with data:', { adminId, createHostelDto });
      
      // Handle adminId validation
      if (!adminId) {
        throw new BadRequestException('Admin ID is required');
      }
      
      const { location, amenities, ...dtoData } = createHostelDto;
      
      // Parse location if it's a string
      let parsedLocation;
      if (typeof location === 'string') {
        try {
          parsedLocation = JSON.parse(location);
          console.log('Parsed location from string:', parsedLocation);
        } catch (parseError) {
          console.error('Location parse error:', parseError);
          throw new BadRequestException('Invalid location JSON format');
        }
      } else {
        parsedLocation = location;
        console.log('Location already parsed:', parsedLocation);
      }
      
      // Validate location data
      console.log('Validating location:', parsedLocation);
      console.log('lng type:', typeof parsedLocation?.lng, 'value:', parsedLocation?.lng);
      console.log('lat type:', typeof parsedLocation?.lat, 'value:', parsedLocation?.lat);
      
      if (!parsedLocation || 
          typeof parsedLocation.lng !== 'number' || 
          typeof parsedLocation.lat !== 'number' ||
          isNaN(parsedLocation.lng) ||
          isNaN(parsedLocation.lat)) {
        console.error('Location validation failed:', parsedLocation);
        throw new BadRequestException(`Invalid location data provided. Expected numbers, got lng: ${typeof parsedLocation?.lng} (${parsedLocation?.lng}), lat: ${typeof parsedLocation?.lat} (${parsedLocation?.lat})`);
      }
      
      // Parse amenities if it's a string
      let parsedAmenities;
      if (typeof amenities === 'string') {
        try {
          parsedAmenities = JSON.parse(amenities);
        } catch (parseError) {
          throw new BadRequestException('Invalid amenities JSON format');
        }
      } else {
        parsedAmenities = amenities;
      }
      
      const point = this.toPoint(parsedLocation.lng, parsedLocation.lat);
      console.log('Generated point:', point);
      
      // Upload images to Cloudinary
      const imageUrls: string[] = [];

      if (files && files.length > 0) {
        console.log(`Uploading ${files.length} files to Cloudinary`);
        for (const file of files) {
          try {
            const url = await this.cloudinary.uploadImage(file);
            imageUrls.push(url);
            console.log('Uploaded image:', url);
          } catch (uploadError) {
            console.error('Failed to upload image:', uploadError);
            throw new BadRequestException(`Failed to upload image: ${uploadError.message}`);
          }
        }
      }

      // Prepare data for insertion
      const insertData = {
        name: dtoData.name,
        email: dtoData.email,
        phone: dtoData.phone,
        SecondaryNumber: dtoData.SecondaryNumber,
        description: dtoData.description,
        address: dtoData.address,
        admin_id: adminId,
        location: point,
        images: imageUrls,
        amenities: parsedAmenities,
        base_price: dtoData.base_price,
        payment_method: dtoData.payment_method,
        bank_details: dtoData.bank_details || null,
        momo_details: dtoData.momo_details || null,
        max_occupancy: dtoData.max_occupancy || 0,
        house_rules: dtoData.house_rules || '',
        nearby_facilities: dtoData.nearby_facilities || [],
        check_in_time: dtoData.check_in_time || null,
        check_out_time: dtoData.check_out_time || null,
        is_verified: false,
        is_active: true,
        accepting_bookings: true, // Default to accepting bookings
        rating: 0,
        total_reviews: 0
      };
      
      console.log('Inserting data into Supabase:', insertData);

      const { data, error } = await this.supabase.client
        .from('hostels')
        .insert([insertData])
        .select('*')
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }

      console.log('Successfully created hostel:', data);
      return data;
      
    } catch (error) {
      console.error('Error in create method:', error);
      
      // Clean up uploaded images if database insert failed
      if (files && files.length > 0) {
        console.log('Cleaning up uploaded images due to error');
        // Note: You might want to implement cleanup logic here
      }
      
      // Re-throw the error with more context
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to create hostel: ${error.message}`);
    }
  }

  // Keep the original findAll method for super admins
  async findAll() {
    try {
      const { data, error } = await this.supabase.client
        .from('hostels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase findAll error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in findAll method:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const { data, error } = await this.supabase.client
        .from('hostels')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase findOne error:', error);
        throw new NotFoundException('Hostel not found');
      }
      
      return data;
    } catch (error) {
      console.error('Error in findOne method:', error);
      throw error;
    }
  }

  // Updated method to toggle booking status with ownership verification
  async toggleBookingStatus(id: string, acceptingBookings: boolean) {
    try {
      console.log(`Toggling booking status for hostel ${id} to ${acceptingBookings}`);
      
      const { data, error } = await this.supabase.client
        .from('hostels')
        .update({ 
          accepting_bookings: acceptingBookings,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('id, name, accepting_bookings')
        .single();

      if (error) {
        console.error('Supabase toggleBookingStatus error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new NotFoundException('Hostel not found');
      }
      
      console.log('Successfully toggled booking status:', data);
      return {
        message: `Hostel ${data.name} is now ${acceptingBookings ? 'accepting' : 'not accepting'} bookings`,
        hostel: data
      };
      
    } catch (error) {
      console.error('Error in toggleBookingStatus method:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to toggle booking status: ${error.message}`);
    }
  }

  async update(id: string, updateHostelDto: UpdateHostelDto, files?: import('multer').File[]) {
    try {
      const existingHostel = await this.findOne(id);
      let imageUpdates: string[] = [];

      // Handle image uploads
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            const url = await this.cloudinary.uploadImage(file);
            imageUpdates.push(url);
          } catch (uploadError) {
            console.error('Failed to upload image during update:', uploadError);
            throw new BadRequestException(`Failed to upload image: ${uploadError.message}`);
          }
        }
      }

      // Parse and validate location if provided
      let locationUpdate = {};
      if (updateHostelDto.location) {
        console.log('Location data received for update:', updateHostelDto.location, typeof updateHostelDto.location);
        
        let parsedLocation;
        
        // Parse location if it's a string
        if (typeof updateHostelDto.location === 'string') {
          try {
            parsedLocation = JSON.parse(updateHostelDto.location);
            console.log('Parsed location from string:', parsedLocation);
          } catch (parseError) {
            console.error('Location parse error:', parseError);
            throw new BadRequestException('Invalid location JSON format');
          }
        } else {
          parsedLocation = updateHostelDto.location;
          console.log('Location already parsed:', parsedLocation);
        }
        
        // Validate location data
        console.log('Validating location:', parsedLocation);
        console.log('lng type:', typeof parsedLocation?.lng, 'value:', parsedLocation?.lng);
        console.log('lat type:', typeof parsedLocation?.lat, 'value:', parsedLocation?.lat);
        
        if (!parsedLocation || 
            typeof parsedLocation.lng !== 'number' || 
            typeof parsedLocation.lat !== 'number' ||
            isNaN(parsedLocation.lng) ||
            isNaN(parsedLocation.lat)) {
          console.error('Location validation failed:', parsedLocation);
          throw new BadRequestException(`Invalid location data provided. Expected numbers, got lng: ${typeof parsedLocation?.lng} (${parsedLocation?.lng}), lat: ${typeof parsedLocation?.lat} (${parsedLocation?.lat})`);
        }
        
        locationUpdate = {
          location: this.toPoint(parsedLocation.lng, parsedLocation.lat)
        };
      }

      // Parse amenities if provided
      let amenitiesUpdate = {};
      if (updateHostelDto.amenities) {
        console.log('Amenities data received for update:', updateHostelDto.amenities, typeof updateHostelDto.amenities);
        
        let parsedAmenities;
        
        // Parse amenities if it's a string
        if (typeof updateHostelDto.amenities === 'string') {
          try {
            parsedAmenities = JSON.parse(updateHostelDto.amenities);
            console.log('Parsed amenities from string:', parsedAmenities);
          } catch (parseError) {
            console.error('Amenities parse error:', parseError);
            throw new BadRequestException('Invalid amenities JSON format');
          }
        } else {
          parsedAmenities = updateHostelDto.amenities;
          console.log('Amenities already parsed:', parsedAmenities);
        }
        
        // Validate amenities structure
        const expectedAmenities = ['wifi', 'laundry', 'cafeteria', 'parking', 'security'];
        const isValidAmenities = parsedAmenities && 
          typeof parsedAmenities === 'object' &&
          expectedAmenities.every(amenity => 
            parsedAmenities.hasOwnProperty(amenity) && 
            typeof parsedAmenities[amenity] === 'boolean'
          );
        
        if (!isValidAmenities) {
          console.error('Invalid amenities structure:', parsedAmenities);
          throw new BadRequestException('Invalid amenities data structure');
        }
        
        amenitiesUpdate = { amenities: parsedAmenities };
      }

      // Prepare update data - exclude location and amenities from spread to avoid conflicts
      const { location, amenities, ...restOfDto } = updateHostelDto;
      
      const updateData = {
        ...restOfDto,
        base_price: updateHostelDto.base_price,
        payment_method: updateHostelDto.payment_method,
        bank_details: updateHostelDto.bank_details,
        momo_details: updateHostelDto.momo_details,
        max_occupancy: updateHostelDto.max_occupancy,
        house_rules: updateHostelDto.house_rules,
        nearby_facilities: updateHostelDto.nearby_facilities,
        check_in_time: updateHostelDto.check_in_time,
        check_out_time: updateHostelDto.check_out_time,
        ...locationUpdate,
        ...amenitiesUpdate,
        images: [...(existingHostel.images || []), ...imageUpdates],
        updated_at: new Date().toISOString()
      };

      console.log('Update data being sent to database:', updateData);

      const { data, error } = await this.supabase.client
        .from('hostels')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }
      
      console.log('Successfully updated hostel:', data);
      return data;
    } catch (error) {
      console.error('Error in update method:', error);
      
      // Clean up uploaded images if database update failed
      if (files && files.length > 0) {
        console.log('Cleaning up uploaded images due to error');
        // Note: You might want to implement cleanup logic here
      }
      
      // Re-throw the error with more context
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to update hostel: ${error.message}`);
    }
  }

  async getRoomTypesByHostelId(hostelId: string): Promise<any> {
    return this.roomsService.getRoomTypesByHostelId(hostelId);
  }

  async getRoomTypeByIdStudent(hostelId: string, roomTypeId: string): Promise<RoomType> {
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

  async getRoomTypesByHostelIdStudent(hostelId: string): Promise<any> {
    return this.roomsService.getRoomTypesByHostelId(hostelId);
  }

  async removeImage(id: string, imageUrl: string) {
    try {
      const hostel = await this.findOne(id);
      const publicId = this.cloudinary.extractPublicId(imageUrl);
      
      if (!publicId) {
        throw new BadRequestException('Invalid image URL');
      }
      
      // Remove from Cloudinary
      await this.cloudinary.deleteImage(publicId);
      
      // Update hostel images
      const updatedImages = hostel.images.filter(img => img !== imageUrl);
      
      const { data, error } = await this.supabase.client
        .from('hostels')
        .update({ images: updatedImages })
        .eq('id', id)
        .select('images')
        .single();

      if (error) {
        console.error('Supabase removeImage error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error in removeImage method:', error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const hostel = await this.findOne(id);
      
      // Delete all images from Cloudinary
      for (const imageUrl of hostel.images) {
        const publicId = this.cloudinary.extractPublicId(imageUrl);
        if (publicId) {
          try {
            await this.cloudinary.deleteImage(publicId);
          } catch (deleteError) {
            console.error('Failed to delete image from Cloudinary:', deleteError);
            // Continue with deletion even if image cleanup fails
          }
        }
      }
      
      const { error } = await this.supabase.client
        .from('hostels')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase remove error:', error);
        throw new BadRequestException(`Database error: ${error.message}`);
      }

      return { message: 'Hostel deleted successfully' };
    } catch (error) {
      console.error('Error in remove method:', error);
      throw error;
    }
  }
}