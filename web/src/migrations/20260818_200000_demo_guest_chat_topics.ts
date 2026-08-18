import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// D-029 приёмка (findings): у ChatTopics не было demoGuest-поля/хука вообще —
// демо-тренер мог наплодить неограниченно тем чата в обход лимита 5 (C2).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_topics" ADD COLUMN "demo_guest" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_topics" DROP COLUMN "demo_guest";`)
}
