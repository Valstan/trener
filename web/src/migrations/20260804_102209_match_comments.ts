import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_match_comments_author_role" AS ENUM('child', 'parent', 'coach', 'staff');
  CREATE TABLE "match_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"match_id" integer NOT NULL,
  	"group_id" integer NOT NULL,
  	"author_id" integer,
  	"author_name" varchar NOT NULL,
  	"author_role" "enum_match_comments_author_role" NOT NULL,
  	"body" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "match_comments_id" integer;
  ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "match_comments_match_idx" ON "match_comments" USING btree ("match_id");
  CREATE INDEX "match_comments_group_idx" ON "match_comments" USING btree ("group_id");
  CREATE INDEX "match_comments_author_idx" ON "match_comments" USING btree ("author_id");
  CREATE INDEX "match_comments_updated_at_idx" ON "match_comments" USING btree ("updated_at");
  CREATE INDEX "match_comments_created_at_idx" ON "match_comments" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_match_comments_fk" FOREIGN KEY ("match_comments_id") REFERENCES "public"."match_comments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_match_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("match_comments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_match_comments_fk";
  DROP INDEX "payload_locked_documents_rels_match_comments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "match_comments_id";
  ALTER TABLE "match_comments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "match_comments" CASCADE;
  DROP TYPE "public"."enum_match_comments_author_role";`)
}
