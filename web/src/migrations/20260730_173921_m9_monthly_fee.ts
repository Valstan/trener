import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "branches" ADD COLUMN "monthly_fee" numeric;
  ALTER TABLE "groups" ADD COLUMN "monthly_fee" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "branches" DROP COLUMN "monthly_fee";
  ALTER TABLE "groups" DROP COLUMN "monthly_fee";`)
}
