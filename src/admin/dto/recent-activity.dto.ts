import { ApiProperty } from '@nestjs/swagger';

export class ActivityUserDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class RecentActivityDto {
  @ApiProperty() id: string;

  @ApiProperty({ enum: ['user', 'booking', 'hostel', 'payment'] })
  type: 'user' | 'booking' | 'hostel' | 'payment';

  @ApiProperty() action: string;
  @ApiProperty() description: string;
  @ApiProperty() timestamp: Date;

  @ApiProperty({ required: false, type: ActivityUserDto })
  user?: ActivityUserDto;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}
