import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketActivities1783869352840 implements MigrationInterface {
    name = 'AddTicketActivities1783869352840'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ticket_activities_type_enum" AS ENUM('created', 'status_changed', 'priority_changed', 'assigned', 'unassigned', 'edited')`);
        await queryRunner.query(`CREATE TABLE "ticket_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticket_id" uuid NOT NULL, "actor_id" uuid, "type" "public"."ticket_activities_type_enum" NOT NULL, "from_value" text, "to_value" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fea672ec7d9867e390d5a153881" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2715f926ba0ddd73514eb0bef6" ON "ticket_activities" ("ticket_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ceea364d29ac20cba4a38fa74" ON "ticket_activities" ("actor_id") `);
        await queryRunner.query(`ALTER TABLE "ticket_activities" ADD CONSTRAINT "FK_2715f926ba0ddd73514eb0bef61" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_activities" ADD CONSTRAINT "FK_6ceea364d29ac20cba4a38fa748" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_activities" DROP CONSTRAINT "FK_6ceea364d29ac20cba4a38fa748"`);
        await queryRunner.query(`ALTER TABLE "ticket_activities" DROP CONSTRAINT "FK_2715f926ba0ddd73514eb0bef61"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ceea364d29ac20cba4a38fa74"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2715f926ba0ddd73514eb0bef6"`);
        await queryRunner.query(`DROP TABLE "ticket_activities"`);
        await queryRunner.query(`DROP TYPE "public"."ticket_activities_type_enum"`);
    }

}
