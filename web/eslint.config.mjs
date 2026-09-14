import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

// ESLint flat config НАПРЯМУЮ, без обёртки FlatCompat.
//
// До Next 16 `eslint-config-next` отдавал конфиг в старом (eslintrc) формате, и его
// приходилось переводить через `FlatCompat`. В 16 пакет отдаёт нативные flat-конфиги, и
// прежняя обёртка не просто лишняя — она ПАДАЕТ: валидатор eslintrc сериализует конфиг
// через JSON.stringify, а во flat-конфиге плагины ссылаются друг на друга по кругу
// («Converting circular structure to JSON», property 'react' closes the circle).
//
// Симптом обманчив: выглядит как поломка правил линта, а на деле сломан только мост
// между двумя форматами конфигурации.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // ── Правила React Compiler, приехавшие с Next 16 ─────────────────────────
      // В 16 `eslint-config-next` включает react-hooks v6 с правилами компилятора, и
      // они сразу дают 8 ошибок в КОДЕ, который не менялся. Ставим 'warn', а не
      // выключаем: находки должны остаться видимыми, но кампания по ним — отдельная
      // работа, а не довесок к бампу версии (иначе UI-правки без прогона приложения
      // едут на прод под видом «обновления фреймворка»).
      //
      // `purity` у нас даёт ТРИ срабатывания, и все три — `Date.now()` в АСИНХРОННЫХ
      // серверных компонентах (`child/page.tsx`, `coach/schedule`, `parent/schedule`):
      // там это ровно то, что нужно — «сейчас» на момент запроса. Правило целится в
      // клиентские компоненты, которые компилятор мемоизирует; к серверным оно
      // неприменимо по смыслу.
      //
      // `set-state-in-effect` — пять срабатываний в клиентских компонентах
      // (ThemeToggle, InstallPrompt, PushSubscribe, AnnouncementsFeed). Здесь сигнал
      // настоящий и требует разбора по каждому; заведено хвостом в SESSION_HANDOFF.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',

      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // `next lint` игнорировал служебное сам; прямой `eslint .` — нет, и без этих строк
    // линт идёт по артефактам сборки и сгенерённым файлам.
    ignores: ['.next/', 'node_modules/', 'src/app/(payload)/admin/importMap.js'],
  },
]

export default eslintConfig
