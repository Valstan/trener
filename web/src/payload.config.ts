import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter, type NodemailerAdapterArgs } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { ru } from '@payloadcms/translations/languages/ru'
import sharp from 'sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Branches } from './collections/Branches'
import { Subscriptions } from './collections/Subscriptions'
import { Groups } from './collections/Groups'
import { Players } from './collections/Players'
import { TrainingSessions } from './collections/TrainingSessions'
import { Consents } from './collections/Consents'
import { LoginTokens } from './collections/LoginTokens'
import { Devices } from './collections/Devices'
import { Notifications } from './collections/Notifications'
import { Rsvps } from './collections/Rsvps'
import { Announcements } from './collections/Announcements'
import { Questions } from './collections/Questions'
import { QuestionMessages } from './collections/QuestionMessages'
import { Matches } from './collections/Matches'
import { ChatTopics } from './collections/ChatTopics'
import { ChatMessages } from './collections/ChatMessages'
import { ChatReads } from './collections/ChatReads'
import { PaymentMessages, PaymentThreads } from './collections/PaymentThreads'
import { MatchComments } from './collections/MatchComments'
import { ChildRegistrations } from './collections/ChildRegistrations'
import { LegalDocuments } from './collections/LegalDocuments'
import { LegalSignatures } from './collections/LegalSignatures'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Явный переключатель «Приложение / Администрация» в начале навигации.
    components: {
      beforeNavLinks: ['@/components/admin/OpenAppLink'],
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
    // push автосинхронизирует схему в dev. В ПРОДЕ push выключен (G20/GONBA-паттерн):
    // drizzle-push на старте может зависнуть на интерактивном y/N-промпте в non-TTY
    // (systemd) и опасен деструктивными авто-изменениями. Прод-схема материализуется
    // контролируемо (миграции #017 — PR12; первый деплой — pre-push через туннель).
    push: process.env.NODE_ENV !== 'production',
  }),
  collections: [
    Users,
    Branches,
    Groups,
    Players,
    TrainingSessions,
    Consents,
    LoginTokens,
    Devices,
    Notifications,
    Rsvps,
    Announcements,
    Questions,
    QuestionMessages,
    Matches,
    MatchComments,
    ChildRegistrations,
    Subscriptions,
    ChatTopics,
    ChatMessages,
    ChatReads,
    PaymentThreads,
    PaymentMessages,
    LegalDocuments,
    LegalSignatures,
  ],
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
          // nodemailer 10 убрал `auth` из SMTPConnectionOptions (перенесён в
          // SMTPTransportOptions), а адаптер Payload типизирует transportOptions
          // старым типом. В рантайме createTransport принимает auth — каст.
        } as NodemailerAdapterArgs['transportOptions'],
      })
    : undefined,
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
  // Fail-fast вместо тихого дефолта (аудит #057, вектор a): Payload НЕ валидирует
  // secret и выводит его как sha256(config.secret).slice(0,32). При пустом значении
  // это ПУБЛИЧНО ВЫЧИСЛИМАЯ константа (`sha256('')`), а подпись session-cookie —
  // единственный носитель прав. Пустой/потерянный PAYLOAD_SECRET = forge любой роли.
  // Раньше было `process.env.PAYLOAD_SECRET || ''` — конфиг собирался и подписывал
  // токены предсказуемым ключом. Теперь падаем на старте.
  secret: (() => {
    const s = process.env.PAYLOAD_SECRET
    if (!s) {
      throw new Error(
        'PAYLOAD_SECRET не задан — приложение не стартует (пустой secret = публично вычислимая подпись JWT).',
      )
    }
    return s
  })(),
  // Телеметрия Payload выключена (аудит #057, вектор a): по умолчанию она включена и
  // шлёт POST на telemetry.payloadcms.com (версии, плагины, feature-матрица, хэш
  // домена) — неоговорённый выход наружу для проекта с 152-ФЗ-контуром.
  telemetry: false,
  sharp,
  // Админка на русском (тренеры/админ — русскоязычные). Локализация контента
  // (мультиязычные поля) не нужна — проект одноязычный, в отличие от Sabantuy.
  //
  // ⚠️ Одного fallbackLanguage мало: он срабатывает, лишь когда язык браузера НЕ
  // поддержан, а Payload из коробки поддерживает английский — владелец с английской
  // локалью в браузере получал английскую панель («Collections», «Create New») вперемешку
  // с русскими полями (п.13 аудита 30.07). supportedLanguages оставляет ровно русский.
  i18n: {
    fallbackLanguage: 'ru',
    supportedLanguages: { ru },
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
