import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { isDemo } from '@/access/roles'

// Плашка демо-режима (D-029): показывается на КАЖДОМ экране за AppShell, если
// текущий юзер — демо (порождён туром /demo, не живой регистрацией). Нужна,
// чтобы человек, попавший в демо-тур, не принял выдуманные данные за реальные
// и знал, как выйти («Сменить роль» → /demo).
//
// Async server component — свой payload.auth(), как на обычных /coach-страницах
// (см. coach/schedule/page.tsx): AppShell сам по себе синхронный, но допускает
// async-детей (RSC), поэтому auth не нужно поднимать выше.
//
// Почему СВОЙ auth, а не проп user сверху (ruling контролёра): проп пришлось бы
// прокидывать через ~30 страниц, каждая из которых уже вызывает AppShell.
// Забытый проп на новой странице молча снимает маркировку демо-режима — плашка
// «смывается» без единой ошибки. Одна точка вкрутки внутри компонента делает
// маркировку несмываемой ценой одного лишнего auth-lookup на SSR-страницу.
//
// Рендерится ПЕРЕД <header className="app-header"> в обычном потоке (не sticky),
// чтобы не перекрывать липкую шапку: шапка сама sticky top:0, а плашка просто
// сдвигает её вниз на высоту своей строки.
export const DemoRibbon = async () => {
  // Плашка — украшение, не источник правды: если свой auth здесь упадёт
  // (сеть, БД, что угодно), молча гасим её, а не роняем страницу. Судьбу
  // СВОЕГО auth решает сама страница — это лишь дублирующая проверка сверху.
  let isDemoUser = false
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await nextHeaders() })
    isDemoUser = isDemo(user)
  } catch {
    return null
  }

  if (!isDemoUser) return null

  return (
    <div className="demo-ribbon">
      <span>🎭 Демо-режим — данные выдуманы</span>
      <Link href="/demo">Сменить роль</Link>
    </div>
  )
}
