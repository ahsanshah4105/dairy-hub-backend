import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveOtpFromUser1788888888888 implements MigrationInterface {
  name = 'RemoveOtpFromUser1788888888888';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_expires_at"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otp_expires_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otp_code" character varying`,
    );
  }
}
