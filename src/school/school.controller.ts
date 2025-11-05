import { Controller, Get, Query } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('schools')
export class SchoolController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async getSchools(@Query('search') search?: string) {
    let query = this.supabase.client
      .from('schools')
      .select('id, name, domain, location')
      .order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const { data: schools, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch schools: ${error.message}`);
    }

    return schools;
  }

  @Get(':id')
  async getSchool(@Query('id') id: string) {
    const { data: school, error } = await this.supabase.client
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !school) {
      throw new Error('School not found');
    }

    return school;
  }
}