import Script from 'next/script'
import React from 'react'

import { METRIKA_COUNTER_ID } from '@/lib/metrika'

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
      {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
ym(${id},'init',{ssr:true,accurateTrackBounce:true,trackLinks:true});`}
    </Script>
  )
}

// Видимый информер посещаемости в подвале — то, ради чего затевался D-017:
// «кабинет открывают раз в месяц, подвал — каждый раз». Ставится рядом с
// подписью автора. Формат — компактный, число посетителей.
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
        src={`https://informer.yandex.ru/informer/${id}/3_1_FFFFFFFF_EFEFEFFF_0_pageviews`}
        alt="Яндекс.Метрика"
        width={88}
        height={31}
        style={{ width: 88, height: 31, border: 0 }}
      />
    </a>
  )
}
