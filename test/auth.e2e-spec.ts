import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import request from 'supertest';
import { createE2EApp } from './helpers/e2e-app.helper';
import {
  TEST_PASSWORD,
  createTestEmail,
  registerAndVerifyUser,
  loginUser,
} from './helpers/auth.helper';
import { UsersService } from '../src/users/services/users.service';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

describe('Auth E2E', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let usersRepository: Repository<User>;
  let capturedVerificationTokens: Map<string, string>;

  let createdUserEmails: string[];

  beforeAll(async () => {
    ({ app, usersService, usersRepository, capturedVerificationTokens } =
      await createE2EApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    createdUserEmails = [];
    capturedVerificationTokens.clear();
  });

  afterEach(async () => {
    for (const email of [...createdUserEmails].reverse()) {
      const user = await usersService.findByEmail(email);
      if (user) await usersService.remove(user);
    }
  });

  describe('POST /api/auth/register', () => {
    it('registers a user and returns correct shape without sensitive fields', async () => {
      const email = createTestEmail('register');
      createdUserEmails.push(email);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'E2E User', email, password: TEST_PASSWORD })
        .expect(201);

      expect(response.body.message).toBeDefined();
      expect(response.body.user.name).toBe('E2E User');
      expect(response.body.user.email).toBe(email);
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('role');

      const savedUser = await usersService.findByEmail(email);
      expect(savedUser).not.toBeNull();
      expect(savedUser?.email).toBe(email);
      expect(savedUser?.role).toBe(UserRole.USER);
    });

    it('returns 400 when required fields are missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'missing@example.com' })
        .expect(400);

      expect(response.body.message).toEqual(expect.any(Array));
    });

    it('returns 400 for an invalid email address', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: TEST_PASSWORD })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('email')]),
      );
    });

    it('returns 400 when password is shorter than 8 characters', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'short@example.com', password: 'abc' })
        .expect(400);

      expect(response.body.message).toEqual(expect.any(Array));
    });

    it('returns 400 when unknown extra fields are sent (forbidNonWhitelisted)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'extra@example.com',
          password: TEST_PASSWORD,
          isAdmin: true,
        })
        .expect(400);

      expect(response.body.message).toEqual(expect.any(Array));
    });

    it('returns 403 when ADMIN role is requested', async () => {
      const email = createTestEmail('admin-attempt');
      createdUserEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Hacker',
          email,
          password: TEST_PASSWORD,
          role: UserRole.ADMIN,
        })
        .expect(403);

      const user = await usersService.findByEmail(email);
      expect(user).toBeNull();
    });

    it('returns 409 when the email is already registered', async () => {
      const email = createTestEmail('duplicate');
      createdUserEmails.push(email);

      await registerAndVerifyUser(
        app,
        capturedVerificationTokens,
        'First User',
        email,
      );

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Second User', email, password: TEST_PASSWORD })
        .expect(409);
    });
  });

  describe('GET /api/auth/verify-email', () => {
    it('full link verification flow: register → verify → login succeeds', async () => {
      const email = createTestEmail('verify-flow');
      createdUserEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Verify Me', email, password: TEST_PASSWORD })
        .expect(201);

      const unverifiedUser = await usersService.findByEmail(email);
      expect(unverifiedUser?.emailVerifiedAt).toBeNull();

      const token = capturedVerificationTokens.get(email);
      expect(token).toBeDefined();

      await request(app.getHttpServer())
        .get(`/api/auth/verify-email?token=${token}`)
        .expect(200);

      const verifiedUser = await usersService.findByEmail(email);
      expect(verifiedUser?.emailVerifiedAt).not.toBeNull();

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(200);
    });

    it('returns 401 for a tampered verification token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/verify-email?token=tampered.invalid.token')
        .expect(401);
    });

    it('returns 401 for a missing token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/verify-email')
        .expect(401);
    });

    it('returns 200 when called again on an already-verified email', async () => {
      const email = createTestEmail('already-verified');
      createdUserEmails.push(email);

      await registerAndVerifyUser(
        app,
        capturedVerificationTokens,
        'Already Verified',
        email,
      );

      const token = capturedVerificationTokens.get(email);
      expect(token).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(`/api/auth/verify-email?token=${token}`)
        .expect(200);

      expect(response.body.message).toContain('already verified');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('resends email and new token verifies successfully', async () => {
      const email = createTestEmail('resend');
      createdUserEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Resend Me', email, password: TEST_PASSWORD })
        .expect(201);

      capturedVerificationTokens.delete(email);

      await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({ email })
        .expect(200);

      const newToken = capturedVerificationTokens.get(email);
      expect(newToken).toBeDefined();

      await request(app.getHttpServer())
        .get(`/api/auth/verify-email?token=${newToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(200);
    });

    it('returns 200 for a non-existent email without revealing account existence', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody-here@example.com' })
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('returns 200 and does not resend for an already verified user', async () => {
      const email = createTestEmail('resend-verified');
      createdUserEmails.push(email);

      await registerAndVerifyUser(app, capturedVerificationTokens, 'Already Verified', email);

      capturedVerificationTokens.delete(email);

      await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({ email })
        .expect(200);

      expect(capturedVerificationTokens.has(email)).toBe(false);
    });

    it('returns 400 for an invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 401 when user is not verified', async () => {
      const email = createTestEmail('unverified-login');
      createdUserEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Unverified', email, password: TEST_PASSWORD })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(401);
    });

    it('returns 401 for wrong password', async () => {
      const email = createTestEmail('wrong-pw');
      createdUserEmails.push(email);

      await registerAndVerifyUser(app, capturedVerificationTokens, 'Wrong PW User', email);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword!' })
        .expect(401);
    });

    it('returns 401 for a non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: TEST_PASSWORD })
        .expect(401);
    });
  });

  describe('GET /api/auth/me (Bearer token)', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns profile with no sensitive fields when token is valid', async () => {
      const email = createTestEmail('bearer-user');
      createdUserEmails.push(email);

      await registerAndVerifyUser(app, capturedVerificationTokens, 'Protected User', email);

      const accessToken = await loginUser(app, email);

      const profileResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.name).toBe('Protected User');
      expect(profileResponse.body.email).toBe(email);
      expect(profileResponse.body).not.toHaveProperty('passwordHash');
      expect(profileResponse.body).not.toHaveProperty('role');
    });
  });

  describe('Web login cookie flow', () => {
    it('sets HttpOnly cookie on web login and clears it on logout', async () => {
      const email = createTestEmail('web-user');
      createdUserEmails.push(email);

      await registerAndVerifyUser(app, capturedVerificationTokens, 'Web User', email);

      const agent = request.agent(app.getHttpServer());

      const loginResponse = await agent
        .post('/api/auth/web/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(201);

      const cookies = loginResponse.headers['set-cookie'] as unknown as
        string[] | undefined;

      expect(cookies).toBeDefined();
      expect(cookies?.[0]).toContain('HttpOnly');

      await agent.get('/api/auth/me').expect(200);

      await agent.post('/api/auth/web/logout').expect(200);

      await agent.get('/api/auth/me').expect(401);
    });

    it('returns profile without sensitive fields via cookie auth', async () => {
      const email = createTestEmail('cookie-profile');
      createdUserEmails.push(email);

      await registerAndVerifyUser(app, capturedVerificationTokens, 'Cookie User', email);

      const agent = request.agent(app.getHttpServer());

      await agent
        .post('/api/auth/web/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(201);

      const profileResponse = await agent.get('/api/auth/me').expect(200);

      expect(profileResponse.body.name).toBe('Cookie User');
      expect(profileResponse.body.email).toBe(email);
      expect(profileResponse.body).not.toHaveProperty('passwordHash');
      expect(profileResponse.body).not.toHaveProperty('role');
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('updates the profile name', async () => {
      const email = createTestEmail('update-profile');
      createdUserEmails.push(email);

      await registerAndVerifyUser(
        app,
        capturedVerificationTokens,
        'Original Name',
        email,
      );

      const token = await loginUser(app, email);

      const updateResponse = await request(app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(updateResponse.body.message).toContain('updated');
      expect(updateResponse.body.user.name).toBe('Updated Name');

      const dbUser = await usersService.findByEmail(email);
      expect(dbUser?.name).toBe('Updated Name');
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/api/auth/me')
        .send({ name: 'No Token' })
        .expect(401);
    });

    it('returns 400 when name is empty', async () => {
      const email = createTestEmail('empty-name');
      createdUserEmails.push(email);

      await registerAndVerifyUser(
        app,
        capturedVerificationTokens,
        'Has Name',
        email,
      );

      const token = await loginUser(app, email);

      await request(app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('deletes the account when password is correct and clears cookie', async () => {
      const email = createTestEmail('delete-account');
      createdUserEmails.push(email);

      await registerAndVerifyUser(
        app,
        capturedVerificationTokens,
        'To Delete',
        email,
      );

      const agent = request.agent(app.getHttpServer());

      await agent
        .post('/api/auth/web/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(201);

      await agent.get('/api/auth/me').expect(200);

      const deleteResponse = await agent
        .delete('/api/auth/account')
        .send({ password: TEST_PASSWORD })
        .expect(200);

      expect(deleteResponse.body.message).toContain('deleted');

      await agent.get('/api/auth/me').expect(401);

      const dbUser = await usersService.findByEmail(email);
      expect(dbUser).toBeNull();
    });

    it('returns 401 when password is incorrect', async () => {
      const email = createTestEmail('delete-wrong-pw');
      createdUserEmails.push(email);

      await registerAndVerifyUser(
        app,
        capturedVerificationTokens,
        'Stays Here',
        email,
      );

      const token = await loginUser(app, email);

      await request(app.getHttpServer())
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPassword!' })
        .expect(401);

      const dbUser = await usersService.findByEmail(email);
      expect(dbUser).not.toBeNull();
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .delete('/api/auth/account')
        .send({ password: TEST_PASSWORD })
        .expect(401);
    });
  });
});
