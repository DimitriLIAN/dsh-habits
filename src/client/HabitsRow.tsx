/**
 * My Habits row registered into the General section item slot: title +
 * description + a textarea editor with a save control and byte budget. The
 * feature owns its own settings surface; load/save run through the injected
 * REST callbacks while the textarea draft is local component state.
 */

import React, { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { HabitsView } from '../types.ts'
import type { HabitsLocaleKey } from './locales.ts'

/** Registration-side remote face provided by the settings section. */
export interface HabitsRowInjected {
  /** Read the current document. */
  readonly describe: () => Promise<HabitsView>
  /** Persist a new content with its expected revision; rejects with `habits-conflict`. */
  readonly update: (content: string, expectedRevision: string) => Promise<HabitsView>
}

/** Full component props assembled by the Settings slot renderer. */
export type HabitsRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.habits'>
  & InjectFace<HabitsRowInjected>

/** Official --dsw-* token styles (mirrors the built-in General section rows). */
const styles: Record<string, React.CSSProperties> = {
  group: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '16px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)',
  },
  title: {
    fontSize: '14px', lineHeight: '22px', fontWeight: 400,
    color: 'var(--dsw-alias-label-primary)',
  },
  description: {
    fontSize: '12px', lineHeight: '18px', fontWeight: 400,
    color: 'var(--dsw-alias-label-secondary)',
  },
  editor: {
    boxSizing: 'border-box', width: '100%', minHeight: '96px', resize: 'vertical',
    padding: '10px 12px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px',
    background: 'var(--dsw-alias-bg-layer-1)', font: 'inherit', fontSize: '13px', lineHeight: '20px',
    color: 'var(--dsw-alias-label-primary)',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
  },
  bytes: {
    fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)',
  },
  overBudget: { color: 'var(--dsw-alias-state-error-primary)' },
  save: {
    boxSizing: 'border-box', padding: '6px 16px',
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px',
    background: 'var(--dsw-alias-brand-primary)', font: 'inherit', fontSize: '13px', lineHeight: '20px',
    color: '#ffffff', cursor: 'pointer',
  },
  saveDisabled: {
    background: 'var(--dsw-alias-interactive-bg-hover)',
    color: 'var(--dsw-alias-label-secondary)', cursor: 'not-allowed',
  },
  note: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-success-primary)' },
  error: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' },
}

/** Interpolate the byte-budget label from a locale template. */
function bytesLabel(t: (key: HabitsLocaleKey) => string, used: number, max: number): string {
  return t('bytes').replace('{{used}}', String(used)).replace('{{max}}', String(max))
}

/** UTF-8 byte length of a string (the budget unit the host enforces). */
function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length
}

/** Render the My Habits row. */
export function HabitsRow({ t, describe, update }: HabitsRowProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [revision, setRevision] = useState('')
  const [maxBytes, setMaxBytes] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void describe().then((view) => {
      if (!alive) return
      setPhase('ready')
      setContent(view.content)
      setDraft(view.content)
      setRevision(view.revision)
      setMaxBytes(view.maxBytes)
    }).catch(() => {
      if (!alive) return
      setPhase('error')
      setError('load')
    })
    return () => { alive = false }
  }, [describe])

  const used = utf8Bytes(draft)
  const overBudget = used > maxBytes
  const dirty = draft !== content
  const canSave = phase === 'ready' && dirty && !overBudget && !saving

  const onSave = (): void => {
    setSaving(true)
    setError(null)
    void update(draft, revision).then((view) => {
      setSaving(false)
      setSaved(true)
      setContent(view.content)
      setDraft(view.content)
      setRevision(view.revision)
    }).catch(() => {
      setSaving(false)
      setSaved(false)
      setError('conflict')
    })
  }

  return (
    <div style={styles.group}>
      <div style={styles.title}>{t('title')}</div>
      <div style={styles.description}>{t('description')}</div>
      <textarea
        style={styles.editor}
        value={draft}
        disabled={phase !== 'ready'}
        placeholder={t('placeholder')}
        onChange={(event) => {
          setDraft(event.target.value)
          setSaved(false)
        }}
      />
      <div style={styles.footer}>
        <span style={overBudget ? { ...styles.bytes, ...styles.overBudget } : styles.bytes}>
          {bytesLabel(t, used, maxBytes)}
        </span>
        <button
          type="button"
          style={canSave ? styles.save : { ...styles.save, ...styles.saveDisabled }}
          disabled={!canSave}
          onClick={onSave}
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
      {saved && !dirty && error === null && <div style={styles.note}>{t('saved')}</div>}
      {error !== null && (
        <div style={styles.error}>
          {error === 'conflict' ? t('conflict') : error === 'load' ? t('loadError') : t('saveError')}
        </div>
      )}
    </div>
  )
}
