import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitUserTable1788900000000 implements MigrationInterface {
  name = 'SplitUserTable1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create auth_identities table
    await queryRunner.query(`
      CREATE TABLE "auth_identities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phoneNumber" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'user',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_auth_identities_phone" UNIQUE ("phoneNumber"),
        CONSTRAINT "PK_auth_identities" PRIMARY KEY ("id")
      )
    `);

    // 2. Create user_profiles table
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "name" character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "PK_user_profiles" PRIMARY KEY ("id")
      )
    `);

    // 3. Migrate data from old users table (if it exists)
    const tableExists = await queryRunner.hasTable('users');
    if (tableExists) {
      await queryRunner.query(`
        INSERT INTO "auth_identities" ("id", "phoneNumber", "role", "created_at", "updated_at")
        SELECT "id", "phoneNumber", "role", "created_at", "updated_at"
        FROM "users"
      `);

      await queryRunner.query(`
        INSERT INTO "user_profiles" ("user_id", "name", "created_at", "updated_at")
        SELECT "id", "name", "created_at", "updated_at"
        FROM "users"
      `);

      // 4. Drop old table
      await queryRunner.query(`DROP TABLE "users"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100),
        "role" character varying NOT NULL DEFAULT 'user',
        "phoneNumber" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phoneNumber"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Migrate data back
    await queryRunner.query(`
      INSERT INTO "users" ("id", "phoneNumber", "role", "created_at", "updated_at")
      SELECT "id", "phoneNumber", "role", "created_at", "updated_at"
      FROM "auth_identities"
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "name" = p."name"
      FROM "user_profiles" p
      WHERE u."id"::text = p."user_id"
    `);

    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(`DROP TABLE "auth_identities"`);
  }
}
