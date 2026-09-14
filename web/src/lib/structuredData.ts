// JSON-LD для главной (D-088, срез Мозга 12.09: «JSON-LD 0»).
//
// Нейросети и поисковики берут факты отсюда охотнее, чем из текста страницы —
// поэтому здесь ТОЛЬКО факты, которые на этой странице действительно есть.
//
// ⚠️ Чего здесь сознательно НЕТ и почему: `address`, `telephone`, `openingHours`,
// `foundingDate`, `sameAs` школы. Чек-лист Мозга просит NAP-консистентность (name /
// address / phone, одинаковые с карточкой в Яндекс Бизнесе), но этих фактов у проекта
// нет: контакты на лендинге (`salesContacts.ts`) принадлежат РАЗРАБОТЧИКУ платформы,
// а не приёмной школы «Интер», и выдать их за телефон школы значит развести
// NAP-рассинхрон с будущей карточкой в Яндекс Бизнесе — ровно то, что чек-лист
// запрещает. Врать разметкой хуже, чем её не иметь: поисковик сверяет её с карточкой.
// Адрес, телефон, часы и год основания школы — шаг владельца; появятся — дописать
// сюда и заменить Organization на SportsActivityLocation.

const SITE_NAME = 'Интер'
const SITE_TAGLINE = 'футбольная школа в Малмыже'

export const organizationJsonLd = (siteUrl: string, description: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description,
  url: siteUrl,
  areaServed: {
    '@type': 'City',
    name: 'Малмыж',
  },
  knowsLanguage: 'ru',
})
