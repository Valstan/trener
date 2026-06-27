import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX "session_parent_changedAt_idx" ON "notifications" USING btree ("session_id","parent_id","changed_at");
  CREATE UNIQUE INDEX "session_player_idx" ON "rsvps" USING btree ("session_id","player_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "session_parent_changedAt_idx";
  DROP INDEX "session_player_idx";`)
}
