import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_requested_role" AS ENUM('parent', 'coach', 'child');
  CREATE TYPE "public"."enum_child_registrations_status" AS ENUM('owner_review', 'parent_review', 'accepted', 'rejected');
  ALTER TYPE "public"."enum_users_roles" ADD VALUE 'applicant';
  CREATE TABLE "child_registrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"child_name" varchar NOT NULL,
  	"date_of_birth" timestamp(3) with time zone NOT NULL,
  	"parent_name" varchar NOT NULL,
  	"proposed_parent_id" integer,
  	"branch_id" integer,
  	"status" "enum_child_registrations_status" DEFAULT 'owner_review' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "players" ALTER COLUMN "group_id" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "requested_role" "enum_users_requested_role";
  ALTER TABLE "players" ADD COLUMN "branch_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "child_registrations_id" integer;
  ALTER TABLE "child_registrations" ADD CONSTRAINT "child_registrations_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "child_registrations" ADD CONSTRAINT "child_registrations_proposed_parent_id_users_id_fk" FOREIGN KEY ("proposed_parent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "child_registrations" ADD CONSTRAINT "child_registrations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "child_registrations_account_idx" ON "child_registrations" USING btree ("account_id");
  CREATE INDEX "child_registrations_proposed_parent_idx" ON "child_registrations" USING btree ("proposed_parent_id");
  CREATE INDEX "child_registrations_branch_idx" ON "child_registrations" USING btree ("branch_id");
  CREATE INDEX "child_registrations_status_idx" ON "child_registrations" USING btree ("status");
  CREATE INDEX "child_registrations_updated_at_idx" ON "child_registrations" USING btree ("updated_at");
  CREATE INDEX "child_registrations_created_at_idx" ON "child_registrations" USING btree ("created_at");
  ALTER TABLE "players" ADD CONSTRAINT "players_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_child_registrations_fk" FOREIGN KEY ("child_registrations_id") REFERENCES "public"."child_registrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "players_branch_idx" ON "players" USING btree ("branch_id");
  CREATE INDEX "payload_locked_documents_rels_child_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("child_registrations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "players" DROP CONSTRAINT "players_branch_id_branches_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_child_registrations_fk";
  DROP INDEX "players_branch_idx";
  DROP INDEX "payload_locked_documents_rels_child_registrations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "child_registrations_id";
  ALTER TABLE "child_registrations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "child_registrations" CASCADE;
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  UPDATE "users_roles" SET "value" = 'parent' WHERE "value" = 'applicant';
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('owner', 'admin', 'coach', 'parent', 'child');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  ALTER TABLE "players" ALTER COLUMN "group_id" SET NOT NULL;
  ALTER TABLE "users" DROP COLUMN "requested_role";
  ALTER TABLE "players" DROP COLUMN "branch_id";
  DROP TYPE "public"."enum_users_requested_role";
  DROP TYPE "public"."enum_child_registrations_status";`)
}
