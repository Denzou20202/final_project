import { MigrationInterface, QueryRunner } from "typeorm";

// Closes a TOCTOU race in SlaPoliciesService.create(): two concurrent POSTs
// for the same priority both pass the findByPriority-then-save check before
// either row exists, so both insert. findByPriority (used by ticket
// creation, updatePriority, automation) then non-deterministically returns
// one of the duplicates via findOne. Confirmed no existing duplicate rows
// before adding this (SELECT priority, count(*) ... HAVING count(*) > 1).
export class AddSlaPolicyPriorityUnique1784270000000 implements MigrationInterface {
    name = 'AddSlaPolicyPriorityUnique1784270000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sla_policies"
            ADD CONSTRAINT "UQ_sla_policies_priority" UNIQUE ("priority")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sla_policies" DROP CONSTRAINT "UQ_sla_policies_priority"`);
    }
}
