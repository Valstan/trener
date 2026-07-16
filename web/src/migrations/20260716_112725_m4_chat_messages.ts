import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_question_messages_author_role" AS ENUM('parent', 'coach');
  CREATE TABLE "question_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question_id" integer NOT NULL,
  	"group_id" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"author_id" integer,
  	"author_role" "enum_question_messages_author_role" NOT NULL,
  	"body" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "consents" ALTER COLUMN "policy_version" SET DEFAULT '2026-07-11';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "question_messages_id" integer;
  ALTER TABLE "question_messages" ADD CONSTRAINT "question_messages_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "question_messages" ADD CONSTRAINT "question_messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "question_messages" ADD CONSTRAINT "question_messages_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "question_messages" ADD CONSTRAINT "question_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "question_messages_question_idx" ON "question_messages" USING btree ("question_id");
  CREATE INDEX "question_messages_group_idx" ON "question_messages" USING btree ("group_id");
  CREATE INDEX "question_messages_parent_idx" ON "question_messages" USING btree ("parent_id");
  CREATE INDEX "question_messages_author_idx" ON "question_messages" USING btree ("author_id");
  CREATE INDEX "question_messages_updated_at_idx" ON "question_messages" USING btree ("updated_at");
  CREATE INDEX "question_messages_created_at_idx" ON "question_messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_question_messages_fk" FOREIGN KEY ("question_messages_id") REFERENCES "public"."question_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_question_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("question_messages_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "question_messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "question_messages" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_question_messages_fk";
  
  DROP INDEX "payload_locked_documents_rels_question_messages_id_idx";
  ALTER TABLE "consents" ALTER COLUMN "policy_version" SET DEFAULT '2026-06-24';
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "question_messages_id";
  DROP TYPE "public"."enum_question_messages_author_role";`)
}
