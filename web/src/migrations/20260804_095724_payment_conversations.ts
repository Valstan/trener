import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_payment_messages_author_role" AS ENUM('parent', 'staff');
  CREATE TABLE "payment_threads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer NOT NULL,
  	"branch_id" integer,
  	"last_message_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payment_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"thread_id" integer NOT NULL,
  	"author_id" integer,
  	"author_name" varchar NOT NULL,
  	"author_role" "enum_payment_messages_author_role" NOT NULL,
  	"body" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payment_threads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payment_messages_id" integer;
  ALTER TABLE "payment_threads" ADD CONSTRAINT "payment_threads_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_threads" ADD CONSTRAINT "payment_threads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_messages" ADD CONSTRAINT "payment_messages_thread_id_payment_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."payment_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_messages" ADD CONSTRAINT "payment_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payment_threads_parent_idx" ON "payment_threads" USING btree ("parent_id");
  CREATE INDEX "payment_threads_branch_idx" ON "payment_threads" USING btree ("branch_id");
  CREATE INDEX "payment_threads_last_message_at_idx" ON "payment_threads" USING btree ("last_message_at");
  CREATE INDEX "payment_threads_updated_at_idx" ON "payment_threads" USING btree ("updated_at");
  CREATE INDEX "payment_threads_created_at_idx" ON "payment_threads" USING btree ("created_at");
  CREATE UNIQUE INDEX "parent_branch_idx" ON "payment_threads" USING btree ("parent_id","branch_id");
  CREATE INDEX "payment_messages_thread_idx" ON "payment_messages" USING btree ("thread_id");
  CREATE INDEX "payment_messages_author_idx" ON "payment_messages" USING btree ("author_id");
  CREATE INDEX "payment_messages_updated_at_idx" ON "payment_messages" USING btree ("updated_at");
  CREATE INDEX "payment_messages_created_at_idx" ON "payment_messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_threads_fk" FOREIGN KEY ("payment_threads_id") REFERENCES "public"."payment_threads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_messages_fk" FOREIGN KEY ("payment_messages_id") REFERENCES "public"."payment_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payment_threads_id_idx" ON "payload_locked_documents_rels" USING btree ("payment_threads_id");
  CREATE INDEX "payload_locked_documents_rels_payment_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("payment_messages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payment_threads_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payment_messages_fk";
  DROP INDEX "payload_locked_documents_rels_payment_threads_id_idx";
  DROP INDEX "payload_locked_documents_rels_payment_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payment_threads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payment_messages_id";
  ALTER TABLE "payment_threads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payment_messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payment_threads" CASCADE;
  DROP TABLE "payment_messages" CASCADE;
  DROP TYPE "public"."enum_payment_messages_author_role";`)
}
