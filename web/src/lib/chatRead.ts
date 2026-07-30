import type { Payload } from 'payload'

// Отметка «прочитал тему до момента» (M9). Один upsert на пару (участник × тема).
//
// Зовут двое: /chat/read (открыл тему) и /chat/message (написал сам). Второе не
// косметика: без него автор видит собственную реплику как непрочитанное — его же
// сообщение двигает topic.lastMessageAt. Один раз увидев такое, индикатору
// перестают верить, а вместе с ним и всему списку.
//
// Служебная запись: у пользователя нет права create на chat-reads (иначе он мог бы
// подделать отметку за другого), поэтому пишем overrideAccess.
export const markTopicRead = async (payload: Payload, userId: number, topicId: number): Promise<void> => {
  const now = new Date().toISOString()
  const existing = await payload.find({
    collection: 'chat-reads',
    where: { and: [{ user: { equals: userId } }, { topic: { equals: topicId } }] },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'chat-reads',
      id: existing.docs[0].id,
      data: { lastReadAt: now },
      overrideAccess: true,
    })
    return
  }

  await payload.create({
    collection: 'chat-reads',
    data: { user: userId, topic: topicId, lastReadAt: now },
    overrideAccess: true,
  })
}
