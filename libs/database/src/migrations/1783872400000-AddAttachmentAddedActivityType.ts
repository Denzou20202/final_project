import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttachmentAddedActivityType1783872400000 implements MigrationInterface {
    name = 'AddAttachmentAddedActivityType1783872400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'attachment_added'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums; rebuilding the type is only
        // needed if a downgrade must reject the value outright, which isn't
        // required here — down() is a no-op for this migration.
    }

}
