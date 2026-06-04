import type { ChatSession, ChatTurn, ImageSize } from '../types/agnes'

export const HISTORY_STORAGE_KEY = 'agnes_chat_sessions'
export const ACTIVE_SESSION_KEY = 'agnes_chat_active_id'
export const MAX_SESSIONS = 30

export function getStorableTurns(turns: ChatTurn[]): ChatTurn[] {
  return turns.filter((t) => !t.pending)
}

/** 去掉 base64 图片，保留 URL 与全部文字对话 */
export function stripHeavyImages(turns: ChatTurn[]): ChatTurn[] {
  return turns.map((t) => {
    const next: ChatTurn = { ...t }
    if (next.imageSrc?.startsWith('data:')) delete next.imageSrc
    if (next.referenceImageSrc?.startsWith('data:')) delete next.referenceImageSrc
    return next
  })
}

export function cloneTurns(turns: ChatTurn[] | undefined | null): ChatTurn[] {
  if (!Array.isArray(turns) || !turns.length) return []
  return JSON.parse(JSON.stringify(turns)) as ChatTurn[]
}

export function normalizeSessions(raw: ChatSession[]): ChatSession[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => ({
    ...s,
    turns: cloneTurns(s.turns),
  }))
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatSession[]
    return normalizeSessions(parsed)
  } catch {
    return []
  }
}

export type SaveSessionsResult =
  | { ok: true; stripped: boolean; sessions: ChatSession[] }
  | { ok: false; error: string }

export function saveSessions(sessions: ChatSession[]): SaveSessionsResult {
  const slice = sessions.slice(0, MAX_SESSIONS)
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(slice))
    return { ok: true, stripped: false, sessions: normalizeSessions(slice) }
  } catch {
    const stripped = slice.map((s) => ({
      ...s,
      turns: stripHeavyImages(s.turns ?? []),
    }))
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(stripped))
      return { ok: true, stripped: true, sessions: normalizeSessions(stripped) }
    } catch {
      return { ok: false, error: '历史记录保存失败，本地存储可能已满' }
    }
  }
}

export function loadActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

export function saveActiveSessionId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id)
  else localStorage.removeItem(ACTIVE_SESSION_KEY)
}

export function sessionTitleFromTurns(turns: ChatTurn[]): string {
  const first = turns.find((t) => t.role === 'user' && t.prompt?.trim())
  if (!first?.prompt) return '未命名对话'
  const text = first.prompt.trim()
  return text.length > 36 ? `${text.slice(0, 36)}…` : text
}

export function userTurnCount(turns: ChatTurn[]): number {
  return turns.filter((t) => t.role === 'user' && t.prompt?.trim()).length
}

export function lastAssistantImageSrc(turns: ChatTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]
    if (t.role === 'assistant' && t.imageSrc) return t.imageSrc
  }
  return null
}

export function upsertSession(
  sessions: ChatSession[],
  payload: {
    id: string | null
    turns: ChatTurn[]
    size: ImageSize
  },
): { sessions: ChatSession[]; activeId: string } {
  const storable = getStorableTurns(payload.turns)
  if (!storable.length) {
    return { sessions, activeId: payload.id ?? '' }
  }

  const id = payload.id ?? crypto.randomUUID()
  const session: ChatSession = {
    id,
    title: sessionTitleFromTurns(storable),
    updatedAt: Date.now(),
    size: payload.size,
    turns: cloneTurns(storable),
  }

  const idx = sessions.findIndex((s) => s.id === id)
  const next = [...sessions]
  if (idx >= 0) next[idx] = session
  else next.unshift(session)

  next.sort((a, b) => b.updatedAt - a.updatedAt)
  return { sessions: next.slice(0, MAX_SESSIONS), activeId: id }
}

export function formatSessionTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
