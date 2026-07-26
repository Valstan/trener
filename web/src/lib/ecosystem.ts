// Точки входа экосистемы «вмалмыже.рф» за пределами этого приложения.
//
// URL держим в punycode: кириллический литерал в исходнике переживает не всякий
// инструмент (см. грабли с кодировками в auth/oidc.ts и curl на Windows), а ASCII
// одинаков везде. Человекочитаемая форма — в комментарии рядом.

// вход.вмалмыже.рф/services — публичный каталог сервисов Малмыжа (ведёт setka).
export const SERVICES_CATALOG_URL = 'https://xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai/services'

export const SERVICES_CATALOG_LABEL = 'Сервисы Малмыжа'
