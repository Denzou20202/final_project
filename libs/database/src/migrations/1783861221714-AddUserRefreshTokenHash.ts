import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRefreshTokenHash1783861221714 implements MigrationInterface {
    name = 'AddUserRefreshTokenHash1783861221714'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "refresh_token_hash" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refresh_token_hash"`);
    }

}
