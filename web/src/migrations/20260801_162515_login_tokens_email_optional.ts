import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// login_tokens.email обязателен только для purpose 'login' — invite-токен рождается
// без email (родитель ещё неизвестен). NOT NULL снят; условная обязательность —
// validate в коллекции. Вскрылось на массовом импорте (п.6): createInviteToken
// с email '' резался required-валидацией Payload.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "login_tokens" ALTER COLUMN "email" DROP NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Пустые email invite-токенов при откате добиваем '', иначе SET NOT NULL упадёт.
  await db.execute(sql`
   UPDATE "login_tokens" SET "email" = '' WHERE "email" IS NULL;
  ALTER TABLE "login_tokens" ALTER COLUMN "email" SET NOT NULL;`)
}
