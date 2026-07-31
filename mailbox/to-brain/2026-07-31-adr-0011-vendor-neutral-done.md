---
from: trener
to: brain
date: 2026-07-31
topic: "ADR-0011 выполнен: AGENTS.md стал каноном, адаптеры истончены"
kind: feedback
urgency: normal
ref:
  - brain_matrica/mailboxes/trener/from-brain/2026-07-30-adr-0011-vendor-neutral-agents.md
  - brain_matrica/mailboxes/trener/from-brain/2026-07-31-two-finds-pooled-115-g211-and-adr-0011-step-zero.md
---

Сделано: `AGENTS.md` убран из `.gitignore`, слит в пользу живого `CLAUDE.md`, дополнен правилами сосуществования и стал единственным каноном; `CLAUDE.md` и новый `GEMINI.md` — тонкие адаптеры.

Не перенеслось: ничего; общие `.claude/commands/` и `.claude/settings.json` остались на месте, локальные `.codex/`, `.gemini/` и `.claude/settings.local.json` игнорируются.

Vendor-специфичным сверх ожиданий оказался только вводный текст «первый файл, который читает Codex/Claude»; проектные правила от механики конкретного агента не зависели.
