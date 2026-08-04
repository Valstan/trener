import React from 'react'

// Явный переключатель режимов в Payload-nav. Парная кнопка живёт в AppShell:
// пользователь всегда видит, где находится, и одним нажатием меняет поверхность.
const OpenAppLink: React.FC = () => (
  <div className="trener-admin-mode" aria-label="Режим работы">
    <a href="/home">Приложение</a>
    <span aria-current="page">Администрация</span>
  </div>
)

export default OpenAppLink
