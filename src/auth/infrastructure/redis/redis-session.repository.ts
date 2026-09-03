import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { ISessionRepository } from '../../domain/ports/session.repository';
import { REDIS_CLIENT } from '../../../redis/redis.module';

@Injectable()
export class RedisSessionRepository implements ISessionRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async storeSession(
    userId: string,
    sessionId: string,
    hashedToken: string,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `auth:session:${userId}:${sessionId}`;
    await this.redis.set(key, hashedToken, 'EX', ttlSeconds);
  }

  async getSession(userId: string, sessionId: string): Promise<string | null> {
    return this.redis.get(`auth:session:${userId}:${sessionId}`);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(`auth:session:${userId}:${sessionId}`);
  }

  async deleteAllSessions(userId: string): Promise<void> {
    const keys = await this.redis.keys(`auth:session:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
