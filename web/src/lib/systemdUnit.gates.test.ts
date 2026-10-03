import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Аудит #057 (вектор f) добавил песочницу в systemd-юнит. Наивный ProtectHome=yes
// УБИЛ прод: WorkingDirectory = $HOME/trener/releases/current, под ProtectHome=yes
// systemd не может сделать chdir в рабочий каталог, процесс падает со status=200/CHDIR
// и юнит уходит в бесконечный рестарт (03.10, ~20 минут лежащего сайта).
//
// Тест защищает ровно эту связку: sandbox-директивы разрешены, но ProtectHome=read-only
// (полный ProtectHome несовместим с $HOME в WorkingDirectory) и есть ReadWritePaths на
// каталог приложения. Проверка на исходнике — файл рендерится на боксу шаблоном,
// поднять его в юнит-тесте нельзя, а забыть про CHDIR легче всего при правке соседней
// строки (ровно так это и вышло).
const unit = readFileSync(
  fileURLToPath(new URL('../../../deploy/systemd/trener.service', import.meta.url)),
  'utf8',
)

describe('systemd-юнит: песочница не ломает старт', () => {
  it('ProtectHome не равен yes — рабочий каталог живёт в $HOME', () => {
    expect(unit).toMatch(/^ProtectHome=read-only$/m)
    expect(unit).not.toMatch(/^ProtectHome=yes$/m)
  })

  it('ReadWritePaths покрывает каталог приложения', () => {
    expect(unit).toMatch(/^ReadWritePaths=__DEPLOY_HOME__\/trener$/m)
  })

  it('песочница включена по остальным осям', () => {
    for (const key of [
      'NoNewPrivileges=yes',
      'PrivateTmp=yes',
      'PrivateDevices=yes',
      'ProtectSystem=strict',
      'RestrictSUIDSGID=yes',
    ]) {
      expect(unit).toContain(key)
    }
    expect(unit).toMatch(/^RestrictAddressFamilies=.*AF_UNIX$/m)
  })

  it('StartLimit* и UMask на месте (5 крашей больше не оставляют юнит в failed навсегда)', () => {
    expect(unit).toMatch(/^StartLimitIntervalSec=\d+$/m)
    expect(unit).toMatch(/^StartLimitBurst=\d+$/m)
    expect(unit).toMatch(/^UMask=\d{4}$/m)
  })

  it('в юните зафиксировано, что песочница проверена на живом приложении', () => {
    // Комментарий-метка: без отработавшей пробы на боксе этих директив быть не должно.
    // Меняете песочницу — сначала проба на боксе, потом мерж.
    expect(unit).toMatch(/status=200\/CHDIR/)
  })
})
