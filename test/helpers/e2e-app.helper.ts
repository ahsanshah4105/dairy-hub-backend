import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { User } from '../../src/users/entities/user.entity';
import { UsersService } from '../../src/users/services/users.service';
import { EMAIL_SENDER } from '../../src/auth/email/email-sender.interface';

export interface E2EApp {
  app: INestApplication;
  usersService: UsersService;
  usersRepository: Repository<User>;
  capturedVerificationTokens: Map<string, string>;
}

export async function createE2EApp(): Promise<E2EApp> {
  const capturedVerificationTokens = new Map<string, string>();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EMAIL_SENDER)
    .useValue({
      sendVerificationEmail: async (to: string, token: string) => {
        capturedVerificationTokens.set(to, token);
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    usersService: app.get(UsersService),
    usersRepository: app.get<Repository<User>>(getRepositoryToken(User)),
    capturedVerificationTokens,
  };
}
