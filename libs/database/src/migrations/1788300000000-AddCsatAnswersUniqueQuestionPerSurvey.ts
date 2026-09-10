import { MigrationInterface, QueryRunner } from "typeorm";

// CsatService.submitAnswers only ever guarded the cross-request double-submit
// race (a conditional UPDATE on csat_surveys.submitted_at before inserting) —
// nothing at the DB level stopped a single request's own `answers` array
// from listing the same questionId twice, silently inserting duplicate rows
// that skew the CSAT report's per-question averages. submitAnswers now also
// rejects a duplicate questionId within one payload before inserting; this
// unique index is the last line of defense against any other insert path.
// De-dupes any rows that already violate it (keeping the earliest submission
// per survey/question pair) before adding the constraint, since this bug
// predates the fix and may already have live duplicates.
export class AddCsatAnswersUniqueQuestionPerSurvey1788300000000 implements MigrationInterface {
    name = 'AddCsatAnswersUniqueQuestionPerSurvey1788300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "csat_answers" a
            USING "csat_answers" b
            WHERE a."question_id" IS NOT NULL
              AND a."survey_id" = b."survey_id"
              AND a."question_id" = b."question_id"
              AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."id" > b."id"))
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_csat_answers_survey_question" ON "csat_answers" ("survey_id", "question_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_csat_answers_survey_question"`);
    }

}
