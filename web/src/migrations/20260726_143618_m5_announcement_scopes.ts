import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_announcements_scope" AS ENUM('group', 'branch', 'network');
  CREATE TABLE "announcements_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"branches_id" integer
  );
  
  ALTER TABLE "announcements" ALTER COLUMN "group_id" DROP NOT NULL;
  ALTER TABLE "announcements" ADD COLUMN "scope" "enum_announcements_scope" DEFAULT 'group' NOT NULL;
  ALTER TABLE "announcements" ADD COLUMN "pinned" boolean DEFAULT false;
  ALTER TABLE "announcements_rels" ADD CONSTRAINT "announcements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "announcements_rels" ADD CONSTRAINT "announcements_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "announcements_rels_order_idx" ON "announcements_rels" USING btree ("order");
  CREATE INDEX "announcements_rels_parent_idx" ON "announcements_rels" USING btree ("parent_id");
  CREATE INDEX "announcements_rels_path_idx" ON "announcements_rels" USING btree ("path");
  CREATE INDEX "announcements_rels_branches_id_idx" ON "announcements_rels" USING btree ("branches_id");
  CREATE INDEX "announcements_scope_idx" ON "announcements" USING btree ("scope");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "announcements_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "announcements_rels" CASCADE;
  DROP INDEX "announcements_scope_idx";
  ALTER TABLE "announcements" ALTER COLUMN "group_id" SET NOT NULL;
  ALTER TABLE "announcements" DROP COLUMN "scope";
  ALTER TABLE "announcements" DROP COLUMN "pinned";
  DROP TYPE "public"."enum_announcements_scope";`)
}
