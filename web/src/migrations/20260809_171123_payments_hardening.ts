import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscriptions" ADD COLUMN "branch_id" integer;
  ALTER TABLE "subscriptions" ADD COLUMN "recorded_by_id" integer;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscriptions_branch_idx" ON "subscriptions" USING btree ("branch_id");
  CREATE INDEX "subscriptions_recorded_by_idx" ON "subscriptions" USING btree ("recorded_by_id");`)

  // Backfill: филиал существующих записей — по ТЕКУЩЕЙ группе ребёнка (лучшая
  // доступная аппроксимация «на момент оплаты»; recorded_by у истории неизвестен,
  // остаётся NULL). Дети без группы — по player.branch.
  await db.execute(sql`
   UPDATE "subscriptions" s SET "branch_id" = g."branch_id"
     FROM "players" p JOIN "groups" g ON g."id" = p."group_id"
    WHERE s."player_id" = p."id" AND s."branch_id" IS NULL;`)
  await db.execute(sql`
   UPDATE "subscriptions" s SET "branch_id" = p."branch_id"
     FROM "players" p
    WHERE s."player_id" = p."id" AND s."branch_id" IS NULL AND p."branch_id" IS NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_branch_id_branches_id_fk";
  
  ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_recorded_by_id_users_id_fk";
  
  DROP INDEX "subscriptions_branch_idx";
  DROP INDEX "subscriptions_recorded_by_idx";
  ALTER TABLE "subscriptions" DROP COLUMN "branch_id";
  ALTER TABLE "subscriptions" DROP COLUMN "recorded_by_id";`)
}
