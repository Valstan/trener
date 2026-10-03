// Аудит #057 (вектор a): `POST /api/users/first-register` в Payload НЕ проходит через
// field-level access — registerFirstUser делает `payload.create({overrideAccess:true})`,
// где `roles` под ownerField просто игнорируется, а хук ensureFirstUserAdmin повышает
// первого созданного пользователя до owner. Гейт у встроенного эндпоинта один:
// таблица users пуста (свежая БД, migrate:reset, окно до сида).
//
// Для боевой установки это значит: анонимный POST даёт сессию owner. Закрываем путь
// целиком — первый владелец заводится seed-скриптом (`pnpm seed`, `seed:legal`),
// руками, изнутри. Кастомный endpoint с тем же путём перекрывает встроенный: Payload
// проверяет custom endpoints раньше штатных.
export const blockFirstRegister = {
  path: '/first-register',
  method: 'post' as const,
  handler: () =>
    new Response(
      JSON.stringify({
        errors: [{ message: 'Регистрация первого пользователя отключена: первого владельца заводит seed.' }],
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ),
}
