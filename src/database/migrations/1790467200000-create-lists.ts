import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLists1790467200000 implements MigrationInterface {
  name = 'CreateLists1790467200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lists" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying NOT NULL, "position" integer NOT NULL DEFAULT 0, "owner_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_268b525e9a6dd04d0685cb2aaaa" PRIMARY KEY ("id"), CONSTRAINT "FK_eb962e2db9730b4e73dfb580861" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lists_owner_id" ON "lists" ("owner_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lists"`);
  }
}
