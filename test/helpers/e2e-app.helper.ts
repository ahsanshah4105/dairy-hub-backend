import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import RedisMock from 'ioredis-mock';
import { ConfigModule } from '@nestjs/config';

import { AppModule } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { configureApp } from '../../src/configure-app';

export async function createE2EApp(): Promise<{ app: INestApplication; redisClient: any }> {
  // We use ioredis-mock to bypass the real Redis server during tests.
  const redisMock = new RedisMock();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Override the REDIS_CLIENT from RedisModule with our mock
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  
  // Apply the same global pipes, filters, etc. as the real app
  configureApp(app);
  
  await app.init();

  return { app, redisClient: redisMock };
}
