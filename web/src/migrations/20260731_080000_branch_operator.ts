import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "branches" ADD COLUMN "operator_name" varchar;
    ALTER TABLE "branches" ADD COLUMN "operator_legal_form" varchar;
    ALTER TABLE "branches" ADD COLUMN "operator_inn" varchar;
    ALTER TABLE "branches" ADD COLUMN "operator_address" varchar;
    ALTER TABLE "branches" ADD COLUMN "operator_email" varchar;
    ALTER TABLE "branches" ADD COLUMN "operator_phone" varchar;
    ALTER TABLE "branches" ADD COLUMN "operator_responsible_person" varchar;
    ALTER TABLE "branches" ADD COLUMN "processor_agreement_signed_at" timestamp(3) with time zone;
    ALTER TABLE "branches" ADD COLUMN "rkn_notified_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "branches" DROP COLUMN "operator_name";
    ALTER TABLE "branches" DROP COLUMN "operator_legal_form";
    ALTER TABLE "branches" DROP COLUMN "operator_inn";
    ALTER TABLE "branches" DROP COLUMN "operator_address";
    ALTER TABLE "branches" DROP COLUMN "operator_email";
    ALTER TABLE "branches" DROP COLUMN "operator_phone";
    ALTER TABLE "branches" DROP COLUMN "operator_responsible_person";
    ALTER TABLE "branches" DROP COLUMN "processor_agreement_signed_at";
    ALTER TABLE "branches" DROP COLUMN "rkn_notified_at";
  `)
}
