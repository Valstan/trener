import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_auth_provider" AS ENUM('radar');
  ALTER TABLE "users" ADD COLUMN "auth_provider" "enum_users_auth_provider";
  ALTER TABLE "users" ADD COLUMN "external_id" varchar;
  CREATE UNIQUE INDEX "authProvider_externalId_idx" ON "users" USING btree ("auth_provider","external_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "authProvider_externalId_idx";
  ALTER TABLE "users" DROP COLUMN "auth_provider";
  ALTER TABLE "users" DROP COLUMN "external_id";
  DROP TYPE "public"."enum_users_auth_provider";`)
}
