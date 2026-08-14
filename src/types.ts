/**
 * Shared wire types between the host REST surface and the browser half.
 */

/** Current view of the user-global instruction document. */
export interface HabitsView {
  /** Whether the host may persist a change. */
  writable: boolean
  /** Model-facing display path (`~/.dsh/AGENTS.md` or `$DSH_HOME/AGENTS.md`). */
  path: string
  /** Whether the document currently exists on disk. */
  exists: boolean
  /** Full current document content; empty when absent. */
  content: string
  /** Hard UTF-8 byte cap the host enforces on update. */
  maxBytes: number
  /** Content fingerprint (SHA-1 hex); empty when absent. Send back as `expectedRevision`. */
  revision: string
}

/** REST envelope carried by every /api2/habits response. */
export type HabitsResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } }
