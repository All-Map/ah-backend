import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    type: 'postgres',
    url: configService.get<string>('SUPABASE_DB_URL'),
    autoLoadEntities: true,
    synchronize: true, // set to false in production
  }),
  inject: [ConfigService],
};