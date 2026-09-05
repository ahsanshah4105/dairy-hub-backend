import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: isProduction,
      envFilePath: nodeEnv === 'test' ? '.env.test' : '.env',
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: nodeEnv === 'test' ? 'silent' : isProduction ? 'info' : 'debug',
        transport: (isProduction || nodeEnv === 'test')
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                singleLine: true,
              },
            },
      },
    }),
    RedisModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (nodeEnv === 'test') {
          return {
            type: 'better-sqlite3',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
            retryAttempts: 0,
          };
        }
        return {
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
        };
      },
    }),

    AuthModule,
    UsersModule,
  ],
  providers: [
    // Register the DomainExceptionFilter globally
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class AppModule {}
