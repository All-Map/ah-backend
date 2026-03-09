import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
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
import { SchoolModule } from './school/school.module';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { PaymentsModule } from './payment/payments.module';
import { AdminModule } from './admin/admin.module';
import { UserManagementModule } from './admin/users/user-management.module';
import { AccessManagementModule } from './admin/access/access-management.module';
import { BookingManagementModule } from './admin/bookings/booking-management.module';
import { FeedbackModule } from './feeedback/feedback.module';
import { APP_FILTER } from '@nestjs/core';
import { redisStore } from 'cache-manager-redis-store';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        ttl: 60, // default TTL in seconds
      }),
    }),
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }]),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    AuthModule,
    HostelsModule,
    RoomsModule,
    BookingsModule,
    ReviewsModule,
    SchoolModule,
    PaymentsModule,
    AdminModule,
    UserManagementModule,
    AccessManagementModule,
    BookingManagementModule,
    FeedbackModule,
    PublicModule
  ],
  controllers: [AppController],
  providers: [
    {
    provide: APP_FILTER,
    useClass: SentryGlobalFilter,
  },
    AppService, CloudinaryService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(helmet()).forRoutes('*');
  }
}
