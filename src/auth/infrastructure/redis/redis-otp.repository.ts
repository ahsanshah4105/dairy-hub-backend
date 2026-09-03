import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { IOtpRepository } from '../../domain/ports/otp.repository';
import { REDIS_CLIENT } from '../../../redis/redis.module';

@Injectable()
export class RedisOtpRepository implements IOtpRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setCooldown(phoneNumber: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(
      `auth:cooldown:${phoneNumber}`,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async storeOtpHash(phoneNumber: string, hash: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`auth:otp:${phoneNumber}`, hash, 'EX', ttlSeconds);
  }

  async getOtpHash(phoneNumber: string): Promise<string | null> {
    return this.redis.get(`auth:otp:${phoneNumber}`);
  }

  async consumeOtp(phoneNumber: string): Promise<void> {
    await this.redis.del(`auth:otp:${phoneNumber}`);
  }

  async incrementAttempts(phoneNumber: string, windowSeconds: number): Promise<number> {
    const key = `auth:attempts:${phoneNumber}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return attempts;
  }

  async clearAttempts(phoneNumber: string): Promise<void> {
    await this.redis.del(`auth:attempts:${phoneNumber}`);
  }
}
