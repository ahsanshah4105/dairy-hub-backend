import 'reflect-metadata';

import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import { AuthIdentity } from '../auth/infrastructure/persistence/auth-identity.entity';
import { UserProfile } from '../users/infrastructure/persistence/user-profile.entity';

const nodeEnv = process.env.NODE_ENV ?? 'development';

if (nodeEnv !== 'production') {
  const envFile =
    nodeEnv === 'test'
      ? '.env.test'
      : nodeEnv === 'migration'
        ? '.env.migration'
        : '.env';

  config({
    path: envFile,
  });
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

const AppDataSource = new DataSource({
  type: 'postgres',

  host: getRequiredEnv('DB_HOST'),
  port: Number(getRequiredEnv('DB_PORT')),
  username: getRequiredEnv('DB_USERNAME'),
  password: getRequiredEnv('DB_PASSWORD'),
  database: getRequiredEnv('DB_NAME'),

  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,

  entities: [AuthIdentity, UserProfile],

  migrations: [__dirname + '/migrations/*{.ts,.js}'],

  synchronize: false,
});

export default AppDataSource;
