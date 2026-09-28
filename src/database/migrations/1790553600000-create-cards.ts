import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCards1790553600000 implements MigrationInterface {
  name = 'CreateCards1790553600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cards" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "position" integer NOT NULL DEFAULT 0, "list_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5f3269634705fdff4a9935860fc" PRIMARY KEY ("id"), CONSTRAINT "FK_2d636e34938aee366ba98cf1fe9" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cards_list_id" ON "cards" ("list_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cards"`);
  }
}
