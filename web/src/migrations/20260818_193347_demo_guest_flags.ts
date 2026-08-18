import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "groups" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "players" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "training_sessions" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "announcements" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "questions" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "question_messages" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "matches" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "match_comments" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "subscriptions" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "chat_messages" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "payment_threads" ADD COLUMN "demo_guest" boolean DEFAULT false;
  ALTER TABLE "payment_messages" ADD COLUMN "demo_guest" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "groups" DROP COLUMN "demo_guest";
  ALTER TABLE "players" DROP COLUMN "demo_guest";
  ALTER TABLE "training_sessions" DROP COLUMN "demo_guest";
  ALTER TABLE "announcements" DROP COLUMN "demo_guest";
  ALTER TABLE "questions" DROP COLUMN "demo_guest";
  ALTER TABLE "question_messages" DROP COLUMN "demo_guest";
  ALTER TABLE "matches" DROP COLUMN "demo_guest";
  ALTER TABLE "match_comments" DROP COLUMN "demo_guest";
  ALTER TABLE "subscriptions" DROP COLUMN "demo_guest";
  ALTER TABLE "chat_messages" DROP COLUMN "demo_guest";
  ALTER TABLE "payment_threads" DROP COLUMN "demo_guest";
  ALTER TABLE "payment_messages" DROP COLUMN "demo_guest";`)
}
