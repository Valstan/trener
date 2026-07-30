import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "chat_reads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"topic_id" integer NOT NULL,
  	"last_read_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chat_reads_id" integer;
  ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_topic_id_chat_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "chat_reads_user_idx" ON "chat_reads" USING btree ("user_id");
  CREATE INDEX "chat_reads_topic_idx" ON "chat_reads" USING btree ("topic_id");
  CREATE INDEX "chat_reads_updated_at_idx" ON "chat_reads" USING btree ("updated_at");
  CREATE INDEX "chat_reads_created_at_idx" ON "chat_reads" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chat_reads_fk" FOREIGN KEY ("chat_reads_id") REFERENCES "public"."chat_reads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_chat_reads_id_idx" ON "payload_locked_documents_rels" USING btree ("chat_reads_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_reads" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "chat_reads" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_chat_reads_fk";
  
  DROP INDEX "payload_locked_documents_rels_chat_reads_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "chat_reads_id";`)
}
