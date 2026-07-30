import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_chat_messages_author_role" AS ENUM('coach', 'staff', 'parent');
  CREATE TABLE "chat_topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"group_id" integer NOT NULL,
  	"created_by_id" integer,
  	"last_message_at" timestamp(3) with time zone,
  	"closed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "chat_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"topic_id" integer NOT NULL,
  	"group_id" integer NOT NULL,
  	"author_id" integer,
  	"author_name" varchar,
  	"author_role" "enum_chat_messages_author_role",
  	"body" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chat_topics_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chat_messages_id" integer;
  ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_topic_id_chat_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "chat_topics_group_idx" ON "chat_topics" USING btree ("group_id");
  CREATE INDEX "chat_topics_created_by_idx" ON "chat_topics" USING btree ("created_by_id");
  CREATE INDEX "chat_topics_last_message_at_idx" ON "chat_topics" USING btree ("last_message_at");
  CREATE INDEX "chat_topics_updated_at_idx" ON "chat_topics" USING btree ("updated_at");
  CREATE INDEX "chat_topics_created_at_idx" ON "chat_topics" USING btree ("created_at");
  CREATE INDEX "chat_messages_topic_idx" ON "chat_messages" USING btree ("topic_id");
  CREATE INDEX "chat_messages_group_idx" ON "chat_messages" USING btree ("group_id");
  CREATE INDEX "chat_messages_author_idx" ON "chat_messages" USING btree ("author_id");
  CREATE INDEX "chat_messages_updated_at_idx" ON "chat_messages" USING btree ("updated_at");
  CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chat_topics_fk" FOREIGN KEY ("chat_topics_id") REFERENCES "public"."chat_topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chat_messages_fk" FOREIGN KEY ("chat_messages_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_chat_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("chat_topics_id");
  CREATE INDEX "payload_locked_documents_rels_chat_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("chat_messages_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "chat_messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "chat_topics" CASCADE;
  DROP TABLE "chat_messages" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_chat_topics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_chat_messages_fk";
  
  DROP INDEX "payload_locked_documents_rels_chat_topics_id_idx";
  DROP INDEX "payload_locked_documents_rels_chat_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "chat_topics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "chat_messages_id";
  DROP TYPE "public"."enum_chat_messages_author_role";`)
}
