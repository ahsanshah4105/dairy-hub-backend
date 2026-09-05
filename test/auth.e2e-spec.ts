import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import * as crypto from 'crypto';
import { createE2EApp } from './helpers/e2e-app.helper';

describe('Authentication Flow (E2E)', () => {
  let app: INestApplication;
  let redisClient: any;
  let accessToken: string;
  let refreshToken: string;
  const testPhone = '+1234567890';

  beforeAll(async () => {
    const e2e = await createE2EApp();
    app = e2e.app;
    redisClient = e2e.redisClient;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // We don't flush all of redis because we want to test the full flow,
    // but in a real test suite you might isolate tests more carefully.
  });

  describe('1. OTP Request', () => {
    it('/api/auth/send-otp (POST) - should successfully send OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/send-otp')
        .send({ phoneNumber: testPhone })
        .expect(200);

      expect(res.body.message).toBe('OTP sent successfully');

      // Verify cooldown was set in Redis
      const cooldown = await redisClient.get(`auth:cooldown:${testPhone}`);
      expect(cooldown).toBe('1');
    });

    it('/api/auth/send-otp (POST) - should block immediate retry (cooldown)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/send-otp')
        .send({ phoneNumber: testPhone })
        .expect(429); // Too Many Requests (from DomainExceptionFilter)

      expect(res.body.error).toBe('OTP_COOLDOWN');
    });
  });

  describe('2. OTP Verification', () => {
    it('/api/auth/verify-otp (POST) - should verify OTP and return tokens', async () => {
      // In E2E tests, we don't have the actual OTP because it was sent via "SMS".
      // But we can generate a known OTP and inject its hash into Redis for testing.
      const validOtp = '123456';
      const secret = process.env.JWT_VERIFICATION_SECRET || 'e2e-verification-secret';
      const otpHash = crypto.createHmac('sha256', secret).update(validOtp).digest('hex');
      
      // Inject the hash manually to simulate a sent OTP
      await redisClient.set(`auth:otp:${testPhone}`, otpHash, 'EX', 300);

      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phoneNumber: testPhone, otp: validOtp })
        .expect(200);

      expect(res.body.message).toBe('Authentication successful');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.identity).toBeDefined();
      expect(res.body.identity.phoneNumber).toBe(testPhone);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('/api/auth/verify-otp (POST) - should consume OTP so it cannot be reused', async () => {
      const validOtp = '123456'; // Same as above
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phoneNumber: testPhone, otp: validOtp })
        .expect(401);

      expect(res.body.error).toBe('OTP_EXPIRED'); // Because it was deleted upon success
    });
  });

  describe('3. Protected Routes (Profile)', () => {
    it('/api/profile (GET) - should return profile for authenticated user', async () => {
      // Event emitter might take a few ms to create the profile async, but since this is SQLite it's almost instant.
      // We will add a small delay just in case.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await request(app.getHttpServer())
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.userId).toBeDefined();
      expect(res.body.name).toBeNull(); // Because we just created it
    });

    it('/api/profile (PATCH) - should update profile name', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Zohaib' })
        .expect(200);

      expect(res.body.name).toBe('Zohaib');
    });
  });

  describe('4. Token Rotation', () => {
    it('/api/auth/refresh (POST) - should refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(res.body.message).toBe('Token refreshed successfully');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });
  });
});
