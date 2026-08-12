import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Repository } from 'typeorm';

import { User } from '../../src/users/entities/user.entity';
import { UserRole } from '../../src/users/enums/user-role.enum';

export const TEST_PASSWORD = 'Password123!';

export function createTestEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export async function registerAndVerifyUser(
  app: INestApplication,
  capturedVerificationTokens: Map<string, string>,
  name: string,
  email: string,
): Promise<void> {
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ name, email, password: TEST_PASSWORD })
    .expect(201);

  const token = capturedVerificationTokens.get(email);

  if (token) {
    await request(app.getHttpServer())
      .get(`/api/auth/verify-email?token=${token}`)
      .expect(200);
  }
}

export async function loginUser(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  expect(response.body.accessToken).toBeDefined();
  expect(typeof response.body.accessToken).toBe('string');

  return response.body.accessToken as string;
}

export async function makeUserAdmin(
  usersRepository: Repository<User>,
  email: string,
): Promise<void> {
  const user = await usersRepository.findOne({ where: { email } });

  if (!user) {
    throw new Error(`Test user not found: ${email}`);
  }

  user.role = UserRole.ADMIN;
  await usersRepository.save(user);

  const savedAdmin = await usersRepository.findOne({ where: { email } });
  expect(savedAdmin?.role).toBe(UserRole.ADMIN);
}
