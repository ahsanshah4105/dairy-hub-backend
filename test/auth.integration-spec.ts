import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { AppModule } from '../src/app.module';
import { RegistrationService } from '../src/auth/registration.service';
import { UsersService } from '../src/users/services/users.service';

describe('Auth integration', () => {
  let testingModule: TestingModule;
  let registrationService: RegistrationService;
  let usersService: UsersService;
  let testEmail: string;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    registrationService = testingModule.get(RegistrationService);
    usersService = testingModule.get(UsersService);
  });

  beforeEach(() => {
    testEmail = `integration-${Date.now()}@example.com`;
  });

  afterEach(async () => {
    const user = await usersService.findByEmail(testEmail);

    if (user) {
      await usersService.remove(user);
    }
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('registers and saves a user in the database', async () => {
    const password = 'Password123!';

    const result = await registrationService.register({
      name: 'Integration User',
      email: testEmail,
      password,
    });

    const savedUser = await usersService.findByEmailWithPassword(testEmail);

    expect(savedUser).toBeDefined();
    expect(savedUser?.email).toBe(testEmail);
    expect(savedUser?.passwordHash).not.toBe(password);

    const passwordMatches = await argon2.verify(
      savedUser!.passwordHash,
      password,
    );
    expect(passwordMatches).toBe(true);

    expect(savedUser?.emailVerifiedAt).toBeNull();

    expect(result.user.email).toBe(testEmail);
  });
});
