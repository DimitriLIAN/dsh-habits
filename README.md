# dsh-habits

English | [中文](README.zh.md)

A DeepSeek Harness (DSH) plugin that adds a **My Habits** editor to the Web settings → General section. The text you save goes to the user-global instruction document `$DSH_HOME/AGENTS.md`, which the built-in `dsh-agent-instructions` loader already injects into every session — so your preferences and habits reach the model automatically.

No DSH core is modified: the host half registers a small REST surface on `ctx.webServer` (`/api2/habits/describe` + `/api2/habits/update`), and the browser half registers a `settings.general.item` row that calls it. This is the same standalone-bundle pattern as `dsh-web-plugin-manager`.

## Install

```bash
dsh plugin add --profile web github:<owner>/dsh-habits
```

Then restart the `web` profile (`dsh --profile web`) so the bundle layer loads. Open **Settings → General → My habits**, write your note, and save. New sessions pick it up immediately; a running session refreshes on its next file touch or resume.

## How it works

| Layer | Mechanism |
|---|---|
| Host half | `ctx.inject(['webServer'])` → `ctx.webServer.register()` for `describe`/`update` |
| Read | `readFileSync($DSH_HOME/AGENTS.md)`; absence is a blank document, never an error |
| Write | atomic rename under a 65 536-byte budget, with a SHA-1 `expectedRevision` conflict refusal |
| Browser half | `settings.general.item` slot (id `habits`), `fetch` the REST surface |
| Injection | the built-in `dsh-agent-instructions` loader injects `~/.dsh/AGENTS.md` as the workspace-instruction baseline |

## Build

```bash
pnpm install
pnpm run build
```

`build` = host `tsc` + client `tsc` (declarations) + `tsdown` (the `__ModuleLoader__.load` client bundle).

## Known limitations

- **Applies to new sessions** — `dsh-agent-instructions` refreshes on the next successful `read`/`write`/`edit` touch, on resume, or when a shadowed baseline re-enters; a mid-conversation save does not rewrite an already-running session immediately.
- **One editor owns the document** — concurrent edits are arbitrated by the `expectedRevision` conflict refusal, not merged.
