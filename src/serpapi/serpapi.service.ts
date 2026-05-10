import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface NearbyPlace {
  name: string;
  address: string;
  rating?: number;
  reviews?: number;
  type: string;
  thumbnail?: string;
  gpsCoordinates?: { lat: number; lng: number };
  openNow?: boolean;
  phone?: string;
  website?: string;
}

@Injectable()
export class SerpApiService {
  private readonly logger = new Logger(SerpApiService.name);
  private readonly apiKey = process.env.SERPAPI_KEY;
  private readonly baseUrl = 'https://serpapi.com/search';

  constructor(private readonly http: HttpService) {}

  async searchNearbyPlaces(
    lat: number,
    lng: number,
    query: string,
    radius = 2,
  ): Promise<NearbyPlace[]> {
    if (!this.apiKey) {
      this.logger.warn('SERPAPI_KEY not set — skipping nearby places lookup');
      return [];
    }

    try {
      // ll format: @lat,lng,<zoom>z  (15z ≈ 1–2 km radius)
      const zoom = radius <= 1 ? 16 : radius <= 2 ? 15 : 14;
      const params = {
        engine: 'google_maps',
        q: query,
        ll: `@${lat},${lng},${zoom}z`,
        api_key: this.apiKey,
        type: 'search',
        hl: 'en',
      };

      const response = await firstValueFrom(
        this.http.get(this.baseUrl, { params }),
      );

      const results = response.data?.local_results ?? [];

      return results.slice(0, 8).map((place: any) => ({
        name: place.title,
        address: place.address,
        rating: place.rating,
        reviews: place.reviews,
        type: place.type,
        thumbnail: place.thumbnail,
        gpsCoordinates: place.gps_coordinates
          ? { lat: place.gps_coordinates.latitude, lng: place.gps_coordinates.longitude }
          : undefined,
        openNow: place.open_state === 'Open',
        phone: place.phone,
        website: place.website,
      }));
    } catch (error) {
      this.logger.error('SerpAPI request failed:', error?.message ?? error);
      return [];
    }
  }
}
