import { CacheInterceptor, CacheKey, CacheTTL } from "@nestjs/cache-manager";
import { Controller, Get, Param, UseInterceptors } from "@nestjs/common";
import { HostelsService } from "src/hostels/hostels.service";

@Controller('public')
@UseInterceptors(CacheInterceptor)
export class PublicController {
  constructor(private readonly hostelsService: HostelsService) {}

  @Get("hostels")
  @CacheKey('public_hostels')
  @CacheTTL(30)
  findAll() {
    return this.hostelsService.findPublicHostels();
  }

  @Get("hostels/:id")
  @CacheTTL(30)
  findOne(@Param('id') id: string) {
    return this.hostelsService.findPublicHostelById(id);
  }
}