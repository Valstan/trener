import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// П.10 аудита: будущие матчи. Счёт опционален (оба поля пустые = матч предстоит),
// DEFAULT 0 снят — иначе будущий матч рождался бы «сыгранным» 0:0.
//
// ⚠️ Генератор добавил сюда и колонки branches.operator_* — это дрейф снапшота
// (#017): миграция 20260731_080000_branch_operator (batch 12, уже на проде) была
// написана руками без .json. Дельту branches из .ts убрали, а .json этой миграции
// оставлен полным — он возвращает цепочку снапшотов в актуальное состояние.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "matches" ALTER COLUMN "score_our" DROP DEFAULT;
  ALTER TABLE "matches" ALTER COLUMN "score_our" DROP NOT NULL;
  ALTER TABLE "matches" ALTER COLUMN "score_opponent" DROP DEFAULT;
  ALTER TABLE "matches" ALTER COLUMN "score_opponent" DROP NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Будущие матчи (счёт NULL) при откате получают 0:0 — иначе SET NOT NULL упадёт.
  await db.execute(sql`
   UPDATE "matches" SET "score_our" = 0 WHERE "score_our" IS NULL;
  UPDATE "matches" SET "score_opponent" = 0 WHERE "score_opponent" IS NULL;
  ALTER TABLE "matches" ALTER COLUMN "score_our" SET DEFAULT 0;
  ALTER TABLE "matches" ALTER COLUMN "score_our" SET NOT NULL;
  ALTER TABLE "matches" ALTER COLUMN "score_opponent" SET DEFAULT 0;
  ALTER TABLE "matches" ALTER COLUMN "score_opponent" SET NOT NULL;`)
}
