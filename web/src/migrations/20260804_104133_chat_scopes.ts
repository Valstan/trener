import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_chat_topics_scope" AS ENUM('group', 'branch', 'school');
  CREATE TYPE "public"."enum_chat_messages_scope" AS ENUM('group', 'branch', 'school');
  ALTER TABLE "chat_topics" ALTER COLUMN "group_id" DROP NOT NULL;
  ALTER TABLE "chat_messages" ALTER COLUMN "group_id" DROP NOT NULL;
  ALTER TABLE "chat_topics" ADD COLUMN "scope" "enum_chat_topics_scope" DEFAULT 'group';
  ALTER TABLE "chat_topics" ADD COLUMN "branch_id" integer;
  ALTER TABLE "chat_messages" ADD COLUMN "scope" "enum_chat_messages_scope" DEFAULT 'group';
  ALTER TABLE "chat_messages" ADD COLUMN "branch_id" integer;
  ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "chat_topics_scope_idx" ON "chat_topics" USING btree ("scope");
  CREATE INDEX "chat_topics_branch_idx" ON "chat_topics" USING btree ("branch_id");
  CREATE INDEX "chat_messages_scope_idx" ON "chat_messages" USING btree ("scope");
  CREATE INDEX "chat_messages_branch_idx" ON "chat_messages" USING btree ("branch_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_topics" DROP CONSTRAINT "chat_topics_branch_id_branches_id_fk";
  
  ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_branch_id_branches_id_fk";
  
  DROP INDEX "chat_topics_scope_idx";
  DROP INDEX "chat_topics_branch_idx";
  DROP INDEX "chat_messages_scope_idx";
  DROP INDEX "chat_messages_branch_idx";
  ALTER TABLE "chat_topics" ALTER COLUMN "group_id" SET NOT NULL;
  ALTER TABLE "chat_messages" ALTER COLUMN "group_id" SET NOT NULL;
  ALTER TABLE "chat_topics" DROP COLUMN "scope";
  ALTER TABLE "chat_topics" DROP COLUMN "branch_id";
  ALTER TABLE "chat_messages" DROP COLUMN "scope";
  ALTER TABLE "chat_messages" DROP COLUMN "branch_id";
  DROP TYPE "public"."enum_chat_topics_scope";
  DROP TYPE "public"."enum_chat_messages_scope";`)
}
