import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "training_sessions" ADD COLUMN "rsvp_reminder_sent_at" timestamp(3) with time zone;
  CREATE INDEX "training_sessions_rsvp_reminder_sent_at_idx" ON "training_sessions" USING btree ("rsvp_reminder_sent_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "training_sessions_rsvp_reminder_sent_at_idx";
  ALTER TABLE "training_sessions" DROP COLUMN "rsvp_reminder_sent_at";`)
}
