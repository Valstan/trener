import { timingSafeEqual } from 'node:crypto'

/**
 * Сравнение строк постоянного времени (вместо `a !== b`) для секретов, приходящих
 * заголовком: при одинаковой длине `timingSafeEqual` не даёт атакующему измерять
 * правильные байты по времени ответа.
 *
 * Разная длина — сама по себе утечка (секрет фиксированной длины), поэтому при
 * несовпадении длин сравниваем даммы равной длины и всё равно возвращаем false.
 */
export const timingSafeEqualStr = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Потратить константу: длина известна из заголовка, но порядок сравнения
    // не должен зависеть от содержимого.
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
