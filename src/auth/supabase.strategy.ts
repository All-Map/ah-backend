import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  private supabase: SupabaseClient;

  constructor() {
    super();
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string,
    );
  }

  async validate(req: Request) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return false;

    const { data: { user }, error } = await this.supabase.auth.getUser(token);
    if (error) throw new UnauthorizedException();
    
    return user;
  }
}