'use client'

import React, { useMemo, useRef, useState } from 'react'

// Только типы и чистые helpers: parsePlayersCsv не тянет payload и безопасен для
// клиентского бандла; из importPlayers берём ИСКЛЮЧИТЕЛЬНО типы (import type).
import type { ImportApplyRow, ImportPreviewRow } from '@/lib/import/importPlayers'
import { APPLY_ROW_LIMIT, decodeCsvBuffer } from '@/lib/import/parsePlayersCsv'

type Option = { id: number; name: string }
type GroupOption = { id: number; name: string; branchId: number | null }

type PreviewState = {
  rows: ImportPreviewRow[]
  summary: { create: number; exists: number; linked: number; errors: number }
}
type ApplySummary = { created: number; links: number; reissued: number; emailsSent: number; errors: number }

// Коды ошибок → человеческие тексты (§7 дизайна).
const GLOBAL_ERROR_TEXT: Record<string, string> = {
  'too-large': 'Список больше 128 КБ — разбейте его на части.',
  'too-many-rows': 'Больше 400 строк за раз — разбейте список на части.',
  delimiter:
    'Похоже, разделитель — запятая, а в именах тоже запятые. Сохраните файл с разделителем «;» или скопируйте ячейки прямо из Excel.',
  'branch-required': 'Выберите филиал.',
  'branch-not-ready':
    'Филиал ещё не завершил юридическое подключение (реквизиты оператора + договор поручения) — приглашать родителей пока нельзя. Раздел «Юридическое подключение» на главной.',
  input: 'Вставьте список — он пуст или не распознан.',
}

const rowErrorText = (r: { errorCode?: string; groupName: string; duplicateOf?: number }): string => {
  switch (r.errorCode) {
    case 'name-empty':
      return 'пустое имя'
    case 'name-long':
      return 'имя длиннее 100 символов'
    case 'group-empty':
      return 'не указана группа'
    case 'group-not-found':
      return `группа «${r.groupName}» не найдена среди доступных вам`
    case 'group-ambiguous':
      return `в филиале две группы «${r.groupName}» — переименуйте одну`
    case 'duplicate':
      return r.duplicateOf ? `дубль строки ${r.duplicateOf} (то же имя и группа)` : 'дубль (то же имя и группа)'
    default:
      return 'не удалось создать — попробуйте ещё раз'
  }
}

const rowWarningText = (w: string): string =>
  w === 'email-invalid' ? 'email выглядит неверно — письмо не отправим' : 'лишние колонки не сохраняются'

// Форма импорта: ввод → обязательный предпросмотр (без него кнопки «Применить»
// нет) → чанковое применение с прогрессом → таблица ссылок. Любая правка текста
// или филиала сбрасывает предпросмотр — применяется только то, что показано.
export const ImportForm = ({
  branches,
  groups,
}: {
  branches: Option[] | null // null — вызывающий не owner, селект филиала не нужен
  groups: GroupOption[]
}) => {
  const [branchId, setBranchId] = useState<number | null>(branches ? (branches[0]?.id ?? null) : null)
  const [text, setText] = useState('')
  const [sendEmails, setSendEmails] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [applied, setApplied] = useState<ImportApplyRow[] | null>(null)
  const [applySummary, setApplySummary] = useState<ApplySummary | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Группы выбранного филиала — подсказка «как писать имена групп».
  const scopedGroups = useMemo(
    () => (branches ? groups.filter((g) => g.branchId === branchId) : groups),
    [branches, groups, branchId],
  )

  const reset = (): void => {
    setPreview(null)
    setApplied(null)
    setApplySummary(null)
    setProgress(null)
    setError('')
  }

  const editText = (v: string): void => {
    setText(v)
    reset()
  }

  // Файл .csv → ArrayBuffer → decodeCsvBuffer (UTF-8/cp1251) → та же textarea:
  // пользователь видит, что распозналось, и может поправить руками.
  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0]
    if (!f) return
    editText(decodeCsvBuffer(await f.arrayBuffer()))
    e.target.value = '' // повторный выбор того же файла снова сработает
  }

  const runPreview = async (): Promise<void> => {
    reset()
    if (!text.trim()) {
      setError('Вставьте список или выберите файл.')
      return
    }
    if (branches && branchId == null) {
      setError('Выберите филиал.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/coach/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', text, branchId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        errorCode?: string
        rows?: ImportPreviewRow[]
        summary?: PreviewState['summary']
      }
      if (res.ok && data.ok && data.rows && data.summary) {
        setPreview({ rows: data.rows, summary: data.summary })
      } else {
        setError(GLOBAL_ERROR_TEXT[data.errorCode ?? ''] ?? 'Не удалось разобрать список. Попробуйте ещё раз.')
      }
    } catch {
      setError('Не удалось разобрать список. Попробуйте ещё раз.')
    }
    setBusy(false)
  }

  // Применение: подтверждённые строки чанками по 50 последовательно — 400 детей
  // с письмами укладываются в таймаут route (§2). Частичный успех — норма:
  // уже выпущенные ссылки показываем даже если очередной чанк упал.
  const runApply = async (): Promise<void> => {
    if (!preview) return
    const rows = preview.rows.filter((r) => (r.status === 'create' || r.status === 'exists') && r.groupId != null)
    if (!rows.length) return
    setBusy(true)
    setError('')
    setProgress(0)
    const collected: ImportApplyRow[] = []
    const sum: ApplySummary = { created: 0, links: 0, reissued: 0, emailsSent: 0, errors: 0 }
    try {
      for (let i = 0; i < rows.length; i += APPLY_ROW_LIMIT) {
        const chunk = rows.slice(i, i + APPLY_ROW_LIMIT)
        const res = await fetch('/coach/import/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'apply',
            rows: chunk.map((r) => ({ name: r.name, groupId: r.groupId, email: r.email })),
            branchId,
            sendEmails,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          rows?: ImportApplyRow[]
          summary?: ApplySummary
        }
        if (!res.ok || !data.ok || !data.rows || !data.summary) throw new Error('chunk')
        collected.push(...data.rows)
        for (const k of Object.keys(sum) as (keyof ApplySummary)[]) sum[k] += data.summary[k]
        setProgress(Math.min(1, (i + chunk.length) / rows.length))
        setApplied([...collected])
      }
    } catch {
      setError(
        collected.length
          ? 'Часть списка не применилась. Ссылки ниже уже выпущены — сохраните их, исправьте остаток и повторите.'
          : 'Не удалось применить список. Попробуйте ещё раз.',
      )
    }
    setApplySummary(sum)
    setPreview(null)
    setBusy(false)
  }

  const linkRows = (applied ?? []).filter((r) => r.joinUrl)

  const copyAll = async (): Promise<void> => {
    // TSV «имя → группа → ссылка» — вставляется обратно в Excel/WhatsApp.
    await navigator.clipboard.writeText(linkRows.map((r) => `${r.name}\t${r.groupName}\t${r.joinUrl}`).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const downloadCsv = (): void => {
    // Генерим на клиенте: BOM + «;» — так CSV открывается русским Excel без вопросов.
    const q = (s: string): string => `"${s.replace(/"/g, '""')}"`
    const csv =
      '\uFEFF' +
      ['Имя;Группа;Ссылка', ...linkRows.map((r) => [r.name, r.groupName, r.joinUrl ?? ''].map(q).join(';'))].join(
        '\r\n',
      )
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'приглашения.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasEmails = preview ? preview.rows.some((r) => r.email) : true
  const createCount = preview?.summary.create ?? 0
  const reissueCount = preview?.summary.exists ?? 0
  const emailsFailed = (applied ?? []).some((r) => r.emailStatus === 'failed')

  const statusLabel = (r: ImportPreviewRow): React.ReactNode => {
    if (r.status === 'create') return <span className="success-text small">будет создан</span>
    if (r.status === 'exists')
      return <span className="muted small">уже есть — ссылка будет перевыпущена</span>
    if (r.status === 'linked') return <span className="muted small">уже привязан к родителю — пропуск</span>
    return <span className="error-text small">{rowErrorText(r)}</span>
  }

  return (
    <div className="stack-sm">
      {/* Шаг 1 — ввод */}
      <div className="card stack-sm">
        {branches && branches.length > 1 && (
          <div className="field">
            <label htmlFor="imp-branch">Филиал</label>
            <select
              id="imp-branch"
              className="select"
              value={branchId ?? ''}
              onChange={(e) => {
                setBranchId(e.target.value ? Number(e.target.value) : null)
                reset()
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="imp-text">Список детей</label>
          <textarea
            id="imp-text"
            className="textarea"
            style={{ minHeight: 160 }}
            placeholder={'Вставьте список из Excel, по ребёнку на строку:\nИванов Пётр\tСтаршая\tpapa@mail.ru'}
            value={text}
            onChange={(e) => editText(e.target.value)}
          />
        </div>

        <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            …или выберите файл .csv
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={pickFile} />
        </div>

        <p className="note" style={{ margin: 0 }}>
          Колонки: имя ребёнка, группа, email родителя (необязательно). Email никуда не
          сохраняется — он нужен только чтобы отправить приглашение.
        </p>

        {scopedGroups.length ? (
          <p className="muted small" style={{ margin: 0 }}>
            Доступные группы: {scopedGroups.map((g) => g.name).join(', ')}
          </p>
        ) : (
          <p className="error-text" style={{ margin: 0 }}>
            {branches ? 'В этом филиале нет групп — сначала заведите их.' : 'У вас нет доступных групп.'}
          </p>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={sendEmails && hasEmails}
            disabled={!hasEmails}
            onChange={(e) => setSendEmails(e.target.checked)}
          />
          <span>
            Отправить приглашения на email из списка
            {!hasEmails && <span className="muted small"> — в списке нет колонки email</span>}
          </span>
        </label>

        <button
          type="button"
          className="btn btn-primary"
          style={{ justifySelf: 'start' }}
          disabled={busy || !scopedGroups.length}
          onClick={runPreview}
        >
          {busy && progress === null ? 'Проверяем…' : 'Предпросмотр'}
        </button>
        {error && (
          <p className="error-text" style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </div>

      {/* Шаг 2 — предпросмотр (обязательный dry-run) */}
      {preview && (
        <div className="card stack-sm">
          <strong>
            Будет создано {preview.summary.create}, пропущено {preview.summary.exists + preview.summary.linked},
            ошибок {preview.summary.errors}
          </strong>
          {preview.summary.errors > 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Ошибочные строки просто не применятся — можно продолжить, а исправленные
              строки вставить вторым заходом.
            </p>
          )}

          <div className="stack-sm">
            {preview.rows.map((r) => (
              <div key={r.n} className="pending-row" style={{ flexWrap: 'wrap' }}>
                <span>
                  <span className="muted small">строка {r.n}: </span>
                  {r.name || '—'} → {r.groupName || '—'}
                </span>
                <span style={{ textAlign: 'right' }}>
                  {statusLabel(r)}
                  {r.warnings.map((w) => (
                    <span key={w} className="muted small" style={{ display: 'block' }}>
                      ⚠ {rowWarningText(w)}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ justifySelf: 'start' }}
            disabled={busy || createCount + reissueCount === 0}
            onClick={runApply}
          >
            {createCount > 0 ? `Создать ${createCount} детей` : 'Перевыпустить ссылки'}
            {createCount > 0 && reissueCount > 0 ? ` (+ ${reissueCount} ссылок повторно)` : ''}
          </button>
        </div>
      )}

      {/* Прогресс чанков применения */}
      {progress !== null && applySummary === null && (
        <div className="card stack-sm">
          <span className="muted small">Создаём и выпускаем ссылки…</span>
          <div className="progress">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Шаг 3 — результат: таблица ссылок */}
      {applied && applySummary && (
        <div className="card stack-sm">
          <strong>
            Создано {applySummary.created}, ссылок выпущено {applySummary.links}
            {applySummary.reissued ? ` (из них ${applySummary.reissued} перевыпущено)` : ''}
            {sendEmails ? `, писем отправлено ${applySummary.emailsSent}` : ''}
            {applySummary.errors ? `, ошибок ${applySummary.errors}` : ''}
          </strong>

          {emailsFailed && (
            <p className="error-text" style={{ margin: 0 }}>
              Часть писем не ушла — возможно, почта не настроена. Используйте таблицу ссылок.
            </p>
          )}

          <p className="muted small" style={{ margin: 0 }}>
            Ссылки действуют 14 дней. Сохраните таблицу — раздайте ссылки родителям лично
            или в чате группы.
          </p>

          {linkRows.length > 0 && (
            <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={copyAll}>
                {copied ? '✓ Скопировано' : 'Скопировать все'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv}>
                Скачать CSV
              </button>
            </div>
          )}

          <div className="stack-sm">
            {applied.map((r, i) => (
              <div key={i} className="pending-row" style={{ flexWrap: 'wrap' }}>
                <span>
                  {r.name} <span className="muted small">→ {r.groupName}</span>
                  {r.emailStatus === 'sent' && <span className="success-text small"> · письмо ✓</span>}
                  {r.emailStatus === 'failed' && <span className="error-text small"> · письмо не ушло</span>}
                </span>
                {r.status === 'error' ? (
                  <span className="error-text small">{rowErrorText({ ...r, groupName: r.groupName })}</span>
                ) : r.status === 'linked' ? (
                  <span className="muted small">уже привязан — пропуск</span>
                ) : (
                  <span className="small" style={{ wordBreak: 'break-all' }}>
                    {r.joinUrl}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
