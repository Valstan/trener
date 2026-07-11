import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_matches_home_away" AS ENUM('home', 'away');
  CREATE TABLE "matches_scorers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"goals" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "matches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"group_id" integer NOT NULL,
  	"match_date" timestamp(3) with time zone NOT NULL,
  	"opponent" varchar NOT NULL,
  	"home_away" "enum_matches_home_away" DEFAULT 'home' NOT NULL,
  	"location" varchar,
  	"score_our" numeric DEFAULT 0 NOT NULL,
  	"score_opponent" numeric DEFAULT 0 NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "matches_id" integer;
  ALTER TABLE "matches_scorers" ADD CONSTRAINT "matches_scorers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "matches_scorers" ADD CONSTRAINT "matches_scorers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "matches_scorers_order_idx" ON "matches_scorers" USING btree ("_order");
  CREATE INDEX "matches_scorers_parent_id_idx" ON "matches_scorers" USING btree ("_parent_id");
  CREATE INDEX "matches_scorers_player_idx" ON "matches_scorers" USING btree ("player_id");
  CREATE INDEX "matches_group_idx" ON "matches" USING btree ("group_id");
  CREATE INDEX "matches_match_date_idx" ON "matches" USING btree ("match_date");
  CREATE INDEX "matches_updated_at_idx" ON "matches" USING btree ("updated_at");
  CREATE INDEX "matches_created_at_idx" ON "matches" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_matches_fk" FOREIGN KEY ("matches_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_matches_id_idx" ON "payload_locked_documents_rels" USING btree ("matches_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "matches_scorers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "matches" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "matches_scorers" CASCADE;
  DROP TABLE "matches" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_matches_fk";
  
  DROP INDEX "payload_locked_documents_rels_matches_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "matches_id";
  DROP TYPE "public"."enum_matches_home_away";`)
}
