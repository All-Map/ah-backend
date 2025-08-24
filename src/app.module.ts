import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { HostelsModule } from './hostels/hostels.module';
import { CloudinaryService } from './cloudinary/cloudinary.service';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/booking.module';
import { ReviewsModule } from './review/review.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }]),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    AuthModule,
    HostelsModule,
    RoomsModule,
    BookingsModule,
    ReviewsModule
    // UsersModule,
    // HostelsModule,
    // SchoolsModule,
  ],
  controllers: [AppController],
  providers: [AppService, CloudinaryService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(helmet()).forRoutes('*');
  }
}