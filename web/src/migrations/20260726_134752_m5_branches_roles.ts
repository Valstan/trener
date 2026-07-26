import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// M5 batch 6 (docs/m5-design.md §7): филиалы + роли v2.
//   1. Таблица branches + сид первой записи «Малмыж» (прод сид-скрипт не гоняет —
//      первая запись создаётся прямо здесь).
//   2. users.branch_id (nullable — owner без филиала) + users.status.
//   3. groups.branch_id: добавить nullable → backfill «Малмыж» → SET NOT NULL.
//   4. Роли: enum пересобирается (не ADD VALUE — новое значение нельзя
//      использовать в той же транзакции), данные admin → owner; `admin` остаётся
//      в enum как филиальный администратор.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_status" AS ENUM('pending', 'approved');
  CREATE TABLE "branches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"city" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  INSERT INTO "branches" ("name", "city") VALUES ('Малмыж', 'Малмыж');

  ALTER TABLE "users" ADD COLUMN "branch_id" integer;
  ALTER TABLE "users" ADD COLUMN "status" "enum_users_status" DEFAULT 'approved' NOT NULL;
  ALTER TABLE "groups" ADD COLUMN "branch_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "branches_id" integer;

  -- Роли v2: пересборка enum + перевод god-админов во владельцев.
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  UPDATE "users_roles" SET "value" = 'owner' WHERE "value" = 'admin';
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('owner', 'admin', 'coach', 'parent');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";

  -- Backfill: весь существующий контент — филиал №1 «Малмыж»; владельцы — без филиала.
  UPDATE "groups" SET "branch_id" = (SELECT MIN("id") FROM "branches") WHERE "branch_id" IS NULL;
  ALTER TABLE "groups" ALTER COLUMN "branch_id" SET NOT NULL;
  UPDATE "users" SET "branch_id" = (SELECT MIN("id") FROM "branches")
    WHERE "branch_id" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "users_roles" r WHERE r."parent_id" = "users"."id" AND r."value" = 'owner'
      );

  CREATE INDEX "branches_updated_at_idx" ON "branches" USING btree ("updated_at");
  CREATE INDEX "branches_created_at_idx" ON "branches" USING btree ("created_at");
  ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "groups" ADD CONSTRAINT "groups_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_branch_idx" ON "users" USING btree ("branch_id");
  CREATE INDEX "groups_branch_idx" ON "groups" USING btree ("branch_id");
  CREATE INDEX "payload_locked_documents_rels_branches_id_idx" ON "payload_locked_documents_rels" USING btree ("branches_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP CONSTRAINT "users_branch_id_branches_id_fk";

  ALTER TABLE "groups" DROP CONSTRAINT "groups_branch_id_branches_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_branches_fk";

  ALTER TABLE "branches" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "branches" CASCADE;

  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  UPDATE "users_roles" SET "value" = 'admin' WHERE "value" = 'owner';
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'coach', 'parent');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  DROP INDEX "users_branch_idx";
  DROP INDEX "groups_branch_idx";
  DROP INDEX "payload_locked_documents_rels_branches_id_idx";
  ALTER TABLE "users" DROP COLUMN "branch_id";
  ALTER TABLE "users" DROP COLUMN "status";
  ALTER TABLE "groups" DROP COLUMN "branch_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "branches_id";
  DROP TYPE "public"."enum_users_status";`)
}
