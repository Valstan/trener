import type { MetadataRoute } from 'next'

// robots.txt: индексируем публичную витрину, закрываем всё за логином и служебное.
// Файл в КОРНЕ app/ (не в (frontend)) — G12: иначе Next отдаст его по вложенному
// пути, а не по /robots.txt.
const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: '*',
      allow: ['/', '/privacy'],
      disallow: [
        '/admin',
        '/api/',
        '/auth/',
        '/login',
        '/join/',
        '/onboarding/',
        '/pending',
        '/parent',
        '/coach',
        '/child',
        '/chat',
        '/account',
        '/match/',
        '/cron/',
      ],
    },
  ],
  sitemap: `${process.env.NEXT_PUBLIC_SERVER_URL || 'https://интер.вмалмыже.рф'}/sitemap.xml`,
})

export default robots
