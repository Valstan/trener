import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Groups } from './collections/Groups'
import { Players } from './collections/Players'
import { TrainingSessions } from './collections/TrainingSessions'
import { Consents } from './collections/Consents'
import { LoginTokens } from './collections/LoginTokens'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Футбольная школа',
    },
  },
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // MVP/greenfield: push автосинхронизирует схему в dev. Прод-миграции —
    // на этапе деплоя (web/src/migrations/), как у GONBA/Sabantuy (#017).
    push: true,
  }),
  collections: [Users, Groups, Players, TrainingSessions, Consents, LoginTokens],
  // Email — magic-link онбординг (PR2) + уведомления. Провайдеро-независимо через
  // внешний SMTP-relay (env). Пока SMTP_HOST не задан, адаптер не подключаем →
  // Payload пишет письма в консоль (dev/CI: WARN «No email adapter»); сборка и
  // типы остаются зелёными без секретов. Реальные SMTP-доступы — ТОЛЬКО в
  // /etc/trener/trener.env на проде (#008).
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.SMTP_FROM_ADDRESS || 'no-reply@trener.example.ru',
        defaultFromName: process.env.SMTP_FROM_NAME || 'Футбольная школа',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          // 465 = implicit TLS (secure); 587/2525 = STARTTLS (secure:false).
          secure: process.env.SMTP_SECURE
            ? process.env.SMTP_SECURE === 'true'
            : Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
      })
    : undefined,
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  // Админка на русском (тренеры/админ — русскоязычные). Локализация контента
  // (мультиязычные поля) не нужна — проект одноязычный, в отличие от Sabantuy.
  i18n: {
    fallbackLanguage: 'ru',
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
