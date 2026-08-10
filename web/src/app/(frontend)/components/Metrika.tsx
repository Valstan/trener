import Script from 'next/script'
import React from 'react'

import { METRIKA_COUNTER_ID, metrikaSnippet } from '@/lib/metrika'

// Счётчик Яндекс.Метрики (D-017). Монтируется ТОЛЬКО на публичном лендинге:
// в кабинетах его нет намеренно — мандат владельца прямо это оговаривает
// («счётчик посещаемости внутри рабочего экрана школы читается как самоделка»),
// а кроме того там детские ПДн, и лишний внешний скрипт рядом с ними не нужен.
// Поэтому НЕ в layout.tsx (он общий для лендинга и всех экранов за логином).
export const Metrika = () => {
  if (METRIKA_COUNTER_ID == null) return null
  const id = METRIKA_COUNTER_ID
  return (
    <Script id="ym-counter" strategy="afterInteractive">
      {metrikaSnippet(id)}
    </Script>
  )
}

// Видимый информер посещаемости в подвале — то, ради чего затевался D-017:
// «кабинет открывают раз в месяц, подвал — каждый раз». Ставится рядом с
// подписью автора.
//
// Бейдж 88×31 показывает одно число — уникальных посетителей за сегодня
// (`_uniques`). Просмотры и визиты видны в расширенной панели, которую tag.js
// вешает на элемент с классом `ym-advanced-informer`: по наведению открывается
// таблица «просмотры / визиты / посетители» за сегодня, вчера, неделю и месяц.
// Поэтому класс и `data-cid`/`data-lang` обязательны — без них останется
// картинка без всплывающей статистики. Разметка сверена с кодом, который
// кабинет Метрики отдаёт для этого счётчика (10.08).
export const MetrikaInformer = () => {
  if (METRIKA_COUNTER_ID == null) return null
  const id = METRIKA_COUNTER_ID
  return (
    <a
      href={`https://metrika.yandex.ru/stat/?id=${id}&from=informer`}
      target="_blank"
      rel="nofollow noreferrer"
      title="Яндекс.Метрика: данные за сегодня (просмотры, визиты и уникальные посетители)"
      style={{ display: 'inline-block', lineHeight: 0 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://informer.yandex.ru/informer/${id}/3_1_FFFFFFFF_EFEFEFFF_0_uniques`}
        alt="Яндекс.Метрика"
        width={88}
        height={31}
        className="ym-advanced-informer"
        data-cid={id}
        data-lang="ru"
        style={{ width: 88, height: 31, border: 0 }}
      />
    </a>
  )
}
