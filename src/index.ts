/**
 * dsh-habits host service: a small REST surface registered on `ctx.webServer`
 * under /api2/habits/* that reads and writes the user-global instruction
 * document `$DSH_HOME/AGENTS.md`. The built-in dsh-agent-instructions loader
 * already injects that file into every session, so this plugin only owns the
 * editor surface — no DSH core is modified.
 *
 * The official /api channel is Typert-owned and requires generated reflection
 * artifacts a standalone bundle cannot ship, so this plugin uses the same
 * `ctx.webServer` route registration pattern as dsh-web-plugin-manager.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { HabitsResult, HabitsView } from './types.ts'

export type * from './types.ts'

/** Route prefix for the REST surface. */
export const ROUTE_PREFIX = '/api2/habits'

/** Hard UTF-8 byte cap, matching the built-in instruction loader's default render budget. */
const MAX_BYTES = 65536

/** One habits-domain refusal carrying a stable code. */
class HabitsError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}

/** Resolve the Harness home directory (DSH_HOME env, then ~/.dsh). */
function dshHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** Absolute path of the user-global instruction document. */
function habitsPath(): string {
  return join(dshHome(), 'AGENTS.md')
}

/** Model-facing display path, never an absolute machine path. */
function habitsDisplayPath(): string {
  const home = dshHome()
  const defaultHome = join(homedir(), '.dsh')
  return home === defaultHome ? '~/.dsh/AGENTS.md' : '$DSH_HOME/AGENTS.md'
}

/** SHA-1 content fingerprint; the empty string stands for an absent file. */
function contentHash(content: string): string {
  return createHash('sha1').update(content, 'utf8').digest('hex')
}

/** Read the current document: absence is a blank document, never an error. */
function readView(): HabitsView {
  const path = habitsPath()
  const exists = existsSync(path)
  const content = exists ? readFileSync(path, 'utf8') : ''
  return {
    writable: true,
    path: habitsDisplayPath(),
    exists,
    content,
    maxBytes: MAX_BYTES,
    revision: contentHash(content),
  }
}

/**
 * Persist one document atomically under the byte budget. A stale
 * `expectedRevision` is refused instead of silently overwriting a concurrent
 * edit; content over MAX_BYTES is refused.
 */
function writeView(content: string, expectedRevision: string | undefined): HabitsView {
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_BYTES) {
    throw new HabitsError('habits-rejected', `user instructions exceed the ${MAX_BYTES}-byte budget`)
  }
  const current = readView()
  if (expectedRevision !== undefined && expectedRevision !== current.revision) {
    throw new HabitsError('habits-conflict', 'user instructions changed since they were read')
  }
  const path = habitsPath()
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  // Atomic replace: write a sibling then rename, so a crash never leaves a
  // half-written instruction file that would inject as a truncated baseline.
  const staging = `${path}.tmp-${createHash('sha1').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 8)}`
  writeFileSync(staging, content, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(staging, path)
  } catch (error) {
    try { rmSync(staging, { force: true }) } catch { /* best-effort cleanup */ }
    throw error
  }
  return readView()
}

/** Read a JSON request body (bounded). */
function readJsonBody(req: NodeJS.ReadableStream & { destroy?(): void }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1_000_000) { reject(new Error('request body too large')); req.destroy?.() }
      else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    req.on('error', reject)
  })
}

/** Write a JSON response. */
function sendJson(
  res: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void },
  status: number,
  value: unknown,
): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

/** Mount the REST surface. Returns the route disposers (may be empty). */
export function registerRoutes(ctx: Context): (() => void)[] {
  const webServer = ctx.get('webServer') as { register(route: WebRoute): () => void } | undefined
  if (webServer === undefined) return []

  const handler = (op: string) => async (
    req: NodeJS.ReadableStream & { url?: string },
    res: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void },
  ): Promise<void> => {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>
      switch (op) {
        case 'describe': {
          const result: HabitsResult<HabitsView> = { ok: true, value: readView() }
          sendJson(res, 200, result)
          return
        }
        case 'update': {
          const content = typeof body['content'] === 'string' ? body['content'] : ''
          const expectedRevision = typeof body['expectedRevision'] === 'string' ? body['expectedRevision'] : undefined
          const result: HabitsResult<HabitsView> = { ok: true, value: writeView(content, expectedRevision) }
          sendJson(res, 200, result)
          return
        }
        default:
          sendJson(res, 404, { ok: false, error: { code: 'unknown-op', message: op } })
      }
    } catch (error: unknown) {
      if (error instanceof HabitsError) {
        sendJson(res, 200, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      sendJson(res, 400, {
        ok: false,
        error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) },
      })
    }
  }

  const disposers: (() => void)[] = []
  for (const op of ['describe', 'update']) {
    disposers.push(webServer.register({
      kind: 'exact',
      path: `${ROUTE_PREFIX}/${op}`,
      handler: handler(op) as unknown as WebRoute['handler'],
    }))
  }
  return disposers
}

/** Stable Cordis plugin name. */
export const name = 'dsh-habits'

/** Plugin entry: mount the REST routes once the web server is available. */
export function apply(ctx: Context): void {
  // webServer is a sibling include-group row; ctx.inject waits for it like the
  // official agent-tool-presentation waits for codeRuntime.
  ctx.inject(['webServer'], (webCtx: Context) => {
    webCtx.effect(() => {
      const disposers = registerRoutes(webCtx)
      return () => { for (const dispose of disposers) dispose() }
    }, 'dsh-habits: routes')
  })
}

// Function-plugin form: no default export (mixing forms makes the Loader
// discard the named apply).
