import type { MetadataRoute } from 'next'

// sitemap.xml: только публичные страницы. Пер-филиальные варианты политики
// (/privacy?branch=N) не перечисляем — это одна страница с параметром, а списка
// филиалов на этапе сборки нет (страница динамическая, БД при build недоступна).
const sitemap = (): MetadataRoute.Sitemap => {
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://интер.вмалмыже.рф').replace(/\/+$/, '')
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}

export default sitemap
