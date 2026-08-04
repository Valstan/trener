import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_chat_topics_room" AS ENUM('adults', 'children');
  CREATE TYPE "public"."enum_chat_messages_room" AS ENUM('adults', 'children');
  ALTER TYPE "public"."enum_users_roles" ADD VALUE 'child';
  ALTER TYPE "public"."enum_chat_messages_author_role" ADD VALUE 'child';
  ALTER TABLE "users" ADD COLUMN "login" varchar;
  ALTER TABLE "players" ADD COLUMN "date_of_birth" timestamp(3) with time zone;
  ALTER TABLE "players" ADD COLUMN "account_id" integer;
  ALTER TABLE "chat_topics" ADD COLUMN "room" "enum_chat_topics_room" DEFAULT 'adults' NOT NULL;
  ALTER TABLE "chat_messages" ADD COLUMN "room" "enum_chat_messages_room" DEFAULT 'adults' NOT NULL;
  ALTER TABLE "players" ADD CONSTRAINT "players_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "users_login_idx" ON "users" USING btree ("login");
  CREATE UNIQUE INDEX "players_account_idx" ON "players" USING btree ("account_id");
  CREATE INDEX "chat_topics_room_idx" ON "chat_topics" USING btree ("room");
  CREATE INDEX "chat_messages_room_idx" ON "chat_messages" USING btree ("room");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "players" DROP CONSTRAINT "players_account_id_users_id_fk";

  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('owner', 'admin', 'coach', 'parent');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  ALTER TABLE "chat_messages" ALTER COLUMN "author_role" SET DATA TYPE text;
  DROP TYPE "public"."enum_chat_messages_author_role";
  CREATE TYPE "public"."enum_chat_messages_author_role" AS ENUM('coach', 'staff', 'parent');
  ALTER TABLE "chat_messages" ALTER COLUMN "author_role" SET DATA TYPE "public"."enum_chat_messages_author_role" USING "author_role"::"public"."enum_chat_messages_author_role";
  DROP INDEX "users_login_idx";
  DROP INDEX "players_account_idx";
  DROP INDEX "chat_topics_room_idx";
  DROP INDEX "chat_messages_room_idx";
  ALTER TABLE "users" DROP COLUMN "login";
  ALTER TABLE "players" DROP COLUMN "date_of_birth";
  ALTER TABLE "players" DROP COLUMN "account_id";
  ALTER TABLE "chat_topics" DROP COLUMN "room";
  ALTER TABLE "chat_messages" DROP COLUMN "room";
  DROP TYPE "public"."enum_chat_topics_room";
  DROP TYPE "public"."enum_chat_messages_room";`)
}
