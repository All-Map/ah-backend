import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL;

    if (!clientID || clientID === 'your_google_client_id_here') {
      console.error('GOOGLE_CLIENT_ID is missing or not configured');
    }
    if (!clientSecret || clientSecret === 'your_google_client_secret_here') {
      console.error('GOOGLE_CLIENT_SECRET is missing or not configured');
    }
    if (!callbackURL) {
      console.error('GOOGLE_CALLBACK_URL is missing or not configured');
    }

    super({
      clientID: clientID || 'dummy',
      clientSecret: clientSecret || 'dummy',
      callbackURL: callbackURL || 'http://localhost:1000/auth/google/callback',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { name, emails, photos, id } = profile;
      const user = {
        google_id: id,
        email: emails[0].value,
        name: `${name.givenName} ${name.familyName}`,
        picture: photos[0].value,
        accessToken,
      };
      
      const validatedUser = await this.authService.validateGoogleUser(user);
      done(null, validatedUser);
    } catch (error) {
      console.error('Error during Google validation:', error);
      done(error, undefined);
    }
  }
}
