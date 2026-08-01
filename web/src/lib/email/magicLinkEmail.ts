import type { Payload } from 'payload'

import { INVITE_ACCEPT_TTL_MINUTES, INVITE_TOKEN_TTL_DAYS } from '@/lib/auth/invite'
import { LOGIN_TOKEN_TTL_MINUTES } from '@/lib/auth/magicLink'

// База для ссылок в письмах. На проде — публичный URL школы; локально — localhost.
const serverBase = (): string =>
  (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

const buildVerifyUrl = (rawToken: string): string =>
  `${serverBase()}/auth/verify?token=${encodeURIComponent(rawToken)}`

// Имя ребёнка в HTML-тело письма — только через экранирование: имя приходит от
// staff/из CSV и не должно уметь ломать разметку.
const escapeHtml = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Отправляет письмо со ссылкой входа. Best-effort: при отсутствии SMTP-адаптера
// Payload пишет письмо в консоль (dev/CI), на проде уходит через relay. Ошибку
// отправки НЕ пробрасываем наружу — иначе по факту «упало/не упало» можно понять,
// существует ли email (enumeration). В dev дополнительно логируем ссылку, чтобы
// можно было войти без живого SMTP.
export const sendLoginEmail = async (payload: Payload, to: string, rawToken: string): Promise<void> => {
  const url = buildVerifyUrl(rawToken)

  if (process.env.NODE_ENV !== 'production') {
    payload.logger.info(`[magic-link] ссылка входа для ${to}: ${url}`)
  }

  try {
    await payload.sendEmail({
      to,
      subject: 'Вход в Футбольную школу',
      text: `Здравствуйте!\n\nЧтобы войти, перейдите по ссылке (действует ${LOGIN_TOKEN_TTL_MINUTES} минут):\n${url}\n\nЕсли вы не запрашивали вход — просто проигнорируйте это письмо.`,
      html: `<p>Здравствуйте!</p><p>Чтобы войти, нажмите на ссылку (действует ${LOGIN_TOKEN_TTL_MINUTES} минут):</p><p><a href="${url}">Войти в Футбольную школу</a></p><p style="color:#888;font-size:13px">Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>`,
    })
  } catch (err) {
    payload.logger.error(`[magic-link] не удалось отправить письмо: ${(err as Error).message}`)
  }
}

// Письмо-подтверждение привязки родителя к ребёнку (онбординг по приглашению).
// Та же verify-ссылка: переход → кнопка → привязка + вход. best-effort, как и login.
export const sendInviteAcceptEmail = async (
  payload: Payload,
  to: string,
  rawToken: string,
  playerName: string,
): Promise<void> => {
  const url = buildVerifyUrl(rawToken)

  if (process.env.NODE_ENV !== 'production') {
    payload.logger.info(`[magic-link] ссылка привязки для ${to} (ребёнок: ${playerName}): ${url}`)
  }

  try {
    await payload.sendEmail({
      to,
      subject: 'Подтверждение в Футбольной школе',
      text: `Здравствуйте!\n\nВас пригласили в Футбольную школу как родителя ребёнка «${playerName}». Чтобы подтвердить и войти, перейдите по ссылке (действует ${INVITE_ACCEPT_TTL_MINUTES} минут):\n${url}\n\nЕсли вы не ожидали этого письма — просто проигнорируйте его.`,
      html: `<p>Здравствуйте!</p><p>Вас пригласили в Футбольную школу как родителя ребёнка «${escapeHtml(playerName)}». Чтобы подтвердить и войти, нажмите на ссылку (действует ${INVITE_ACCEPT_TTL_MINUTES} минут):</p><p><a href="${url}">Подтвердить и войти</a></p><p style="color:#888;font-size:13px">Если вы не ожидали этого письма — просто проигнорируйте его.</p>`,
    })
  } catch (err) {
    payload.logger.error(`[magic-link] не удалось отправить письмо привязки: ${(err as Error).message}`)
  }
}

// Письмо-приглашение сотруднику (п.5 аудита 30.07). Отличается от обычного входа
// только текстом: человек не запрашивал ссылку сам, ему надо объяснить, откуда она.
// Та же verify-ссылка → кнопка → вход. Пароль не заводим и не передаём: сотрудник
// при желании задаст свой в «Аккаунте».
export const sendStaffInviteEmail = async (
  payload: Payload,
  to: string,
  rawToken: string,
  roleLabel: string,
): Promise<void> => {
  const url = buildVerifyUrl(rawToken)

  if (process.env.NODE_ENV !== 'production') {
    payload.logger.info(`[magic-link] ссылка приглашения для ${to} (${roleLabel}): ${url}`)
  }

  try {
    await payload.sendEmail({
      to,
      subject: 'Приглашение в Футбольную школу',
      text: `Здравствуйте!

Вас пригласили в приложение футбольной школы — роль: ${roleLabel}. Чтобы войти, перейдите по ссылке (действует ${LOGIN_TOKEN_TTL_MINUTES} минут):
${url}

Пароль не нужен: вход по ссылке. Постоянный пароль можно задать потом в разделе «Аккаунт».

Если вы не ожидали этого письма — просто проигнорируйте его.`,
      html: `<p>Здравствуйте!</p><p>Вас пригласили в приложение футбольной школы — роль: <strong>${roleLabel}</strong>. Чтобы войти, нажмите на ссылку (действует ${LOGIN_TOKEN_TTL_MINUTES} минут):</p><p><a href="${url}">Войти в Футбольную школу</a></p><p>Пароль не нужен: вход по ссылке. Постоянный пароль можно задать потом в разделе «Аккаунт».</p><p style="color:#888;font-size:13px">Если вы не ожидали этого письма — просто проигнорируйте его.</p>`,
    })
  } catch (err) {
    payload.logger.error(`[magic-link] не удалось отправить приглашение сотруднику: ${(err as Error).message}`)
  }
}

// Письмо-приглашение родителю при массовом импорте детей (п.6 аудита). Шлём
// JOIN-ссылку (TTL 14 дней), а не accept-токен: его 30 минут для «холодного»
// письма негодны. В отличие от соседей ВОЗВРАЩАЕТ boolean: enumeration-риска нет
// (список адресов дал сам директор), а честный статус «письмо не ушло» нужен ему,
// чтобы раздать ссылку руками.
export const sendPlayerJoinEmail = async (
  payload: Payload,
  to: string,
  joinUrl: string,
  playerName: string,
): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'production') {
    // 152-ФЗ: в dev-лог — только URL, без имени ребёнка и адреса.
    payload.logger.info(`[magic-link] join-ссылка импорта: ${joinUrl}`)
  }

  try {
    await payload.sendEmail({
      to,
      subject: 'Приглашение в Футбольную школу',
      text: `Здравствуйте!

Вас пригласили в приложение футбольной школы как родителя ребёнка «${playerName}». Чтобы подтвердить и видеть расписание группы, перейдите по ссылке (действует ${INVITE_TOKEN_TTL_DAYS} дней):
${joinUrl}

Если вы не ожидали этого письма — просто проигнорируйте его.`,
      html: `<p>Здравствуйте!</p><p>Вас пригласили в приложение футбольной школы как родителя ребёнка «${escapeHtml(playerName)}». Чтобы подтвердить и видеть расписание группы, нажмите на ссылку (действует ${INVITE_TOKEN_TTL_DAYS} дней):</p><p><a href="${joinUrl}">Принять приглашение</a></p><p style="color:#888;font-size:13px">Если вы не ожидали этого письма — просто проигнорируйте его.</p>`,
    })
    return true
  } catch (err) {
    payload.logger.error(`[magic-link] не удалось отправить приглашение родителю: ${(err as Error).message}`)
    return false
  }
}
