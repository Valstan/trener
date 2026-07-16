import type { CollectionBeforeDeleteHook } from 'payload'

// Каскад при удалении ВОПРОСА (головы нитки чата M4). FK-грабля как у
// cleanupSessionRelations: question-messages.question — required (NOT NULL) ⨯
// ON DELETE SET NULL → DELETE головы блокируется. Чистим реплики перед удалением.
// Работает и при каскаде от удаления родителя: cleanupUserRelations удаляет
// questions через payload.delete → этот хук срабатывает на каждый вопрос.
export const cleanupQuestionRelations: CollectionBeforeDeleteHook = async ({
  id,
  req: { payload },
}) => {
  try {
    await payload.delete({
      collection: 'question-messages',
      where: { question: { equals: id } },
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error({ err, questionId: id }, '[cleanup] не удалось очистить реплики удаляемого вопроса')
  }
}
