/** `settings.habits` namespace dictionaries (the My Habits row's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '我的习惯',
  'description': '写一段关于你的偏好和习惯的说明，每次会话都会自动带入（保存后对新会话生效）。',
  'placeholder': '例如：请始终用中文回复；代码风格遵循项目已有约定；改动前先阅读相关测试……',
  'save': '保存',
  'saving': '保存中…',
  'saved': '已保存',
  'conflict': '内容已在别处被修改，请重新加载后再保存。',
  'loadError': '读取我的习惯失败，请稍后重试。',
  'saveError': '保存失败，请稍后重试。',
  'bytes': '{{used}} / {{max}} 字节',
} satisfies Record<string, string>

/** The settings.habits namespace key union. */
export type HabitsLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'My habits',
  'description': 'Write a note about your preferences and habits; it is injected into every session (applies to new sessions after saving).',
  'placeholder': 'For example: always reply in English; follow the repo style; read related tests before editing…',
  'save': 'Save',
  'saving': 'Saving…',
  'saved': 'Saved',
  'conflict': 'The content changed elsewhere; reload and try again.',
  'loadError': 'Failed to load your habits; try again later.',
  'saveError': 'Failed to save; try again later.',
  'bytes': '{{used}} / {{max}} bytes',
} satisfies Record<HabitsLocaleKey, string>
