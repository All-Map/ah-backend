import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SerpApiService } from './serpapi.service';

@Module({
  imports: [HttpModule],
  providers: [SerpApiService],
  exports: [SerpApiService],
})
export class SerpApiModule {}
