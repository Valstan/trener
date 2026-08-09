// IP и user-agent запроса — для журнальных записей подписей (D-016).
// За nginx реальный адрес — в x-forwarded-for (первый элемент списка).
export const clientMeta = (req: Request): { ip: string; userAgent: string } => {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const ip = (fwd.split(',')[0] ?? '').trim() || (req.headers.get('x-real-ip') ?? '').trim()
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 512)
  return { ip: ip.slice(0, 64), userAgent }
}
