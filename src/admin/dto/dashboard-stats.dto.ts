import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty() totalUsers: number;
  @ApiProperty() newUsersToday: number;
  @ApiProperty() totalHostels: number;
  @ApiProperty() verifiedHostels: number;
  @ApiProperty() totalBookings: number;
  @ApiProperty() activeBookings: number;
  @ApiProperty() totalRevenue: number;
  @ApiProperty() revenueThisMonth: number;
  @ApiProperty() userGrowth: number;
  @ApiProperty() bookingGrowth: number;
  @ApiProperty() revenueGrowth: number;
}
