/**
 * dsh-habits browser half: registers the General-section "My Habits" editor
 * row. Load and save go through the host's /api2/habits REST surface
 * (same-origin fetch).
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { HabitsResult, HabitsView } from '../types.ts'
import { HabitsRow, type HabitsRowInjected } from './HabitsRow.tsx'
import { en, zh, type HabitsLocaleKey } from './locales.ts'

export type { HabitsRowInjected, HabitsRowProps } from './HabitsRow.tsx'
export type { HabitsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The My Habits settings row's copy. */
    'settings.habits': HabitsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.habits'

/** Services required by the Settings registration. */
export const inject = ['slots', 'locale']

/** Base URL of the host REST surface. */
const BASE = '/api2/habits'

/** Call one REST op with a JSON body, unwrapping the ok envelope. */
async function call<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE}/${op}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`habits.${op}: HTTP ${response.status}`)
  }
  const envelope = await response.json() as HabitsResult<T>
  if (!envelope.ok) {
    throw new Error(`habits.${op} failed: ${envelope.error.code}: ${envelope.error.message}`)
  }
  return envelope.value
}

/** Contribute the My Habits editor row to the General section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-habits: dictionaries')

  const injected = (): HabitsRowInjected => ({
    describe: () => call<HabitsView>('describe', {}),
    update: (content, expectedRevision) => call<HabitsView>('update', { content, expectedRevision }),
  })

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'habits',
    order: 20,
    locale: NS,
    inject: injected,
  }, HabitsRow))
}
