import path from 'path'
import { fileURLToPath } from 'url'

import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

import { securityHeaders } from './src/lib/securityHeaders'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NEXT_PUBLIC_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Прод-VPS (мелкий, мало RAM) не тянет `next build` (OOM). Сборка едет в CI
  // (GitHub Actions), на сервер кладём готовый standalone-сервер. tracingRoot = web/
  // — чтобы server.js лёг в корень .next/standalone (G17/G20).
  //
  // ⚠️ standalone-сборка делает outputFileTracing, который МУТИРУЕТ локальный
  // node_modules → следующая локальная сборка падает. Поэтому standalone включаем
  // ТОЛЬКО по флагу STANDALONE_BUILD=1 (его ставит deploy-prod.yml). Локальный
  // `next build` — обычный, node_modules не портит.
  output: process.env.STANDALONE_BUILD === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: __dirname,
  // Не называем свой стек сами: до 14.09.2026 прод отдавал `X-Powered-By: Next.js,
  // Payload`, то есть подсказывал сканеру, какие CVE пробовать. Ровно тот класс, по
  // которому прилетел мандат 14.09.
  poweredByHeader: false,
  images: {
    // Перевод конфига на TS (14.09.2026) вскрыл, что раньше пряталось за нетипизированным
    // .js: `url.protocol.replace(':','')` — это `string`, а RemotePattern принимает только
    // 'http' | 'https'. Сужаем явно и падаем на неожиданной схеме, а не пропускаем её молча.
    remotePatterns: [NEXT_PUBLIC_SERVER_URL].map((item) => {
      const url = new URL(item)
      const protocol = url.protocol.replace(':', '')
      if (protocol !== 'http' && protocol !== 'https') {
        throw new Error(`NEXT_PUBLIC_SERVER_URL: ожидался http/https, получено «${protocol}»`)
      }
      return { hostname: url.hostname, protocol }
    }),
  },
  reactStrictMode: true,
  // Список и доводы по каждому заголовку — в src/lib/securityHeaders.ts (там же тест).
  // На ВСЕ пути, включая /admin и /api: дыра в одном разделе обесценивает заголовок
  // в остальных.
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
