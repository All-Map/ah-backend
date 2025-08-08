import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';

export interface School {
  id: string;
  name: string;
  domain: string;
  location: string | { coordinates: [number, number] };
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
  constructor(private readonly supabase: SupabaseService) {}

  async getUserProfile(userId: string): Promise<UserProfile> {
    // Step 1: Get user data
    const { data: user, error: userError } = await this.supabase.client
      .from('users')
      .select('id, name, email, phone, is_verified, role, school_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User profile not found');
    }

    // Step 2: Get school data if available
    let school: School | null = null;
    if (user.school_id) {
      const { data: schoolData, error: schoolError } = await this.supabase.client
        .from('schools')
        .select('id, name, domain, location')
        .eq('id', user.school_id)
        .single();

      if (!schoolError && schoolData) {
        school = {
          id: schoolData.id,
          name: schoolData.name,
          domain: schoolData.domain,
          location: schoolData.location // This will be in WKB format
        };
      }
    }

    // Step 3: Return combined profile
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      is_verified: user.is_verified,
      role: user.role,
      school_id: user.school_id,
      school,
    };
  }
}