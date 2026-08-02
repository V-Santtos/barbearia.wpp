# Origem

- Repositório: https://github.com/pbakaus/impeccable
- Licença: Apache 2.0
- Versão da skill: 4.0.4
- Trazida em: 2026-08-01
- Veredito e motivo: `docs/skills-log.md`

## O que foi trazido

Só `.agents/skills/impeccable/` do repositório — `SKILL.md`, `reference/` (36
documentos), `scripts/` e `agents/`. Os scripts importam **apenas builtins do
Node** (`node:fs`, `node:path`, …), sem dependência externa e sem chave de API.

## O que NÃO foi trazido, e por quê

- `cli/`, `extension/`, `plugin/`, `demos/`, `tests/`, `docs/` — 60 MB e 2.942
  arquivos no repositório inteiro; a skill sozinha são 152 arquivos.
- Os adaptadores por ferramenta (`.gemini`, `.codex`, `.cursor`, `.grok`,
  `.kiro`, `.opencode`, `.pi`, `.qoder`, `.rovodev`, `.trae`, `.vibe`, …) — o
  mesmo espalhamento que reprovou `ruvnet/ruflo` e `affaan-m/ECC`.
- **Os hooks** (`scripts/hook*.mjs` vieram junto, mas nada foi ligado em
  `settings.json`). Mesma decisão tomada com os hooks do `ponytail`: instrução
  passiva repetida a cada prompt não paga o próprio ruído.
- `.claude-plugin/`, `skills-lock.json` do repositório de origem.

## Cuidado ao usar

`/impeccable init` escreve `PRODUCT.md` e `DESIGN.md` **na raiz do projeto**. A
raiz daqui já tem `REGRAS-APRENDIZADOS/` e `CONTEXTO.md` como fonte de verdade, e
duas memórias de projeto competindo é exatamente o que reprovou o ECC. Se `init`
for rodado, que seja com os arquivos dentro de `Dashboard/`, junto do
`uploads/ANEXO_DESIGN_SYSTEM_DASHBOARD.md` — não na raiz.
