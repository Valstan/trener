import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"paid_from" timestamp(3) with time zone,
  	"paid_until" timestamp(3) with time zone NOT NULL,
  	"amount" numeric,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "branches" ADD COLUMN "payment_details" varchar;
  ALTER TABLE "branches" ADD COLUMN "payment_url" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscriptions_player_idx" ON "subscriptions" USING btree ("player_id");
  CREATE INDEX "subscriptions_paid_until_idx" ON "subscriptions" USING btree ("paid_until");
  CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "subscriptions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscriptions_fk";
  
  DROP INDEX "payload_locked_documents_rels_subscriptions_id_idx";
  ALTER TABLE "branches" DROP COLUMN "payment_details";
  ALTER TABLE "branches" DROP COLUMN "payment_url";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscriptions_id";`)
}
