# Mailbox «trener»

**Исходящая** почта для `brain_matrica` (асимметричная схема, ADR-0001 v3).

## Asymmetric scheme — кто куда пишет

| Направление | Кто пишет | Где |
|---|---|---|
| `brain → trener` | brain | `brain_matrica/mailboxes/trener/from-brain/*.md` (мы только читаем через `git pull --ff-only`) |
| `trener → brain` | мы | **`mailbox/to-brain/*.md` в этом репо** (коммитим в свой репо через PR) |

## Что НЕЛЬЗЯ

- ❌ Писать/коммитить что-либо в `brain_matrica/` — brain read-only для наших сессий.
- ❌ Архивировать что-либо в `brain_matrica/` — забота brain'а.
- ❌ Чистить `mailbox/to-brain/` (без архивации на нашей стороне — это делает brain у себя).

## Формат письма

```yaml
---
from: trener
to: brain
date: YYYY-MM-DD
topic: ...
kind: idea | directive | question | feedback | report
compliance: suggest | recommend | mandate   # required для kind=idea и kind=directive
urgency: low | normal | high
ref: [<filename>]   # опционально, если отвечаешь
---
```

## Workflow (через PR-only flow)

```bash
git checkout -b docs/<slug>     # или feat/, fix/, chore/
# создать mailbox/to-brain/YYYY-MM-DD-slug.md
git add mailbox/to-brain/YYYY-MM-DD-slug.md
git commit -m "chore(mailbox): trener → brain <slug>"
git push -u origin docs/<slug>
gh pr create ...
# показать diff → OK → merge --squash --delete-branch
```

Можно объединять с тематическим PR — отдельный PR не обязателен.

## Ссылки

- [ADR-0001 brain ↔ projects mailboxes](../../brain_matrica/adr/0001-brain-projects-mailboxes.md) (v3 — asymmetric)
- [ADR-0002 PR-only flow](../../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md)
- [Входящие письма (read-only)](../../brain_matrica/mailboxes/trener/from-brain/)
