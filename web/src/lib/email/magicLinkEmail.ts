import type { Payload } from 'payload'

import { INVITE_ACCEPT_TTL_MINUTES } from '@/lib/auth/invite'
import { LOGIN_TOKEN_TTL_MINUTES } from '@/lib/auth/magicLink'

// База для ссылок в письмах. На проде — публичный URL школы; локально — localhost.
const serverBase = (): string =>
  (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

const buildVerifyUrl = (rawToken: string): string =>
  `${serverBase()}/auth/verify?token=${encodeURIComponent(rawToken)}`

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
      html: `<p>Здравствуйте!</p><p>Вас пригласили в Футбольную школу как родителя ребёнка «${playerName}». Чтобы подтвердить и войти, нажмите на ссылку (действует ${INVITE_ACCEPT_TTL_MINUTES} минут):</p><p><a href="${url}">Подтвердить и войти</a></p><p style="color:#888;font-size:13px">Если вы не ожидали этого письма — просто проигнорируйте его.</p>`,
    })
  } catch (err) {
    payload.logger.error(`[magic-link] не удалось отправить письмо привязки: ${(err as Error).message}`)
  }
}
