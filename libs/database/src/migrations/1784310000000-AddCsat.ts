import { MigrationInterface, QueryRunner } from "typeorm";

// CSAT: admin-managed question catalog + one survey per ticket (created the
// first time it closes) + one answer row per question on submission. See
// CsatQuestionEntity/CsatSurveyEntity/CsatAnswerEntity for the reasoning
// behind each column (questionText snapshot, denormalized ticket_id on
// answers, etc).
export class AddCsat1784310000000 implements MigrationInterface {
    name = 'AddCsat1784310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'csat_submitted'`);

        await queryRunner.query(`
            CREATE TABLE "csat_questions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "text" character varying(255) NOT NULL,
                "is_enabled" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_csat_questions_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "csat_surveys" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_id" uuid NOT NULL,
                "submitted_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_csat_surveys_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_csat_surveys_ticket_id" ON "csat_surveys" ("ticket_id")`);
        await queryRunner.query(`
            ALTER TABLE "csat_surveys"
            ADD CONSTRAINT "FK_csat_surveys_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE "csat_answers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "survey_id" uuid NOT NULL,
                "ticket_id" uuid NOT NULL,
                "question_id" uuid,
                "question_text" character varying(255) NOT NULL,
                "score" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_csat_answers_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_csat_answers_survey_id" ON "csat_answers" ("survey_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_csat_answers_ticket_id" ON "csat_answers" ("ticket_id")`);
        await queryRunner.query(`
            ALTER TABLE "csat_answers"
            ADD CONSTRAINT "FK_csat_answers_survey" FOREIGN KEY ("survey_id") REFERENCES "csat_surveys"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "csat_answers"
            ADD CONSTRAINT "FK_csat_answers_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "csat_answers"
            ADD CONSTRAINT "FK_csat_answers_question" FOREIGN KEY ("question_id") REFERENCES "csat_questions"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csat_answers" DROP CONSTRAINT "FK_csat_answers_question"`);
        await queryRunner.query(`ALTER TABLE "csat_answers" DROP CONSTRAINT "FK_csat_answers_ticket"`);
        await queryRunner.query(`ALTER TABLE "csat_answers" DROP CONSTRAINT "FK_csat_answers_survey"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_csat_answers_ticket_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_csat_answers_survey_id"`);
        await queryRunner.query(`DROP TABLE "csat_answers"`);

        await queryRunner.query(`ALTER TABLE "csat_surveys" DROP CONSTRAINT "FK_csat_surveys_ticket"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_csat_surveys_ticket_id"`);
        await queryRunner.query(`DROP TABLE "csat_surveys"`);

        await queryRunner.query(`DROP TABLE "csat_questions"`);

        // Postgres has no DROP VALUE for enums — same rationale as every
        // other migration in this lineage (e.g. AddTicketActivityFieldAndMessageEdited).
    }

}
