import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: isProduction,
      envFilePath: nodeEnv === 'test' ? '.env.test' : '.env',
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: Number(configService.getOrThrow<string>('DB_PORT')),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? {
                rejectUnauthorized:
                  configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') !==
                  'false',
              }
            : false,

        autoLoadEntities: true,
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],

        synchronize:
          configService.getOrThrow<string>('DB_SYNCHRONIZE') === 'true',

        migrationsRun:
          configService.getOrThrow<string>('DB_RUN_MIGRATIONS') === 'true',
      }),
    }),

    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
