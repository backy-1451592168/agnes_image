<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { generateImage, imageItemToSrc } from '../api/agnes'
import ChatAvatar from './ChatAvatar.vue'
import DotGridLoader from './DotGridLoader.vue'
import ImageLightbox from './ImageLightbox.vue'
import type { ChatSession, ChatTurn, ImageSize } from '../types/agnes'
import {
  cloneTurns,
  formatSessionTime,
  getStorableTurns,
  loadActiveSessionId,
  loadSessions,
  saveActiveSessionId,
  saveSessions,
  upsertSession,
  userTurnCount,
  lastAssistantImageSrc,
} from '../utils/chatHistory'

const STORAGE_KEY = 'agnes_api_key'
const API_KEYS_URL = 'https://platform.agnes-ai.com/settings/apiKeys'
const MAX_REF_MB = 8

const apiKey = ref('')
const rememberKey = ref(true)
const prompt = ref('')
const size = ref<ImageSize>('1024x768')
const loading = ref(false)
const error = ref<string | null>(null)
const turns = ref<ChatTurn[]>([])
const sessions = ref<ChatSession[]>([])
const activeSessionId = ref<string | null>(null)
const historyOpen = ref(false)
const threadRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const referenceImageSrc = ref<string | null>(null)
const lightboxSrc = ref<string | null>(null)
const refDropActive = ref(false)
const refDragDepth = ref(0)

const sizeOptions: { value: ImageSize; label: string }[] = [
  { value: '1024x768', label: '1024 × 768（横图）' },
  { value: '1024x1024', label: '1024 × 1024（方图）' },
  { value: '1024x1536', label: '1024 × 1536（竖图）' },
]

const effectiveApiKey = computed(() => {
  const fromInput = apiKey.value.trim()
  if (fromInput) return fromInput
  return import.meta.env.VITE_AGNES_API_KEY?.trim() ?? ''
})

const lastImageSrc = computed(() => lastAssistantImageSrc(turns.value))

const isFollowUp = computed(() => lastImageSrc.value !== null)
const hasUploadedRef = computed(() => referenceImageSrc.value !== null)
const isImg2Img = computed(() => hasUploadedRef.value || isFollowUp.value)

const canSubmit = computed(
  () => !loading.value && prompt.value.trim().length > 0 && effectiveApiKey.value.length > 0,
)

const submitLabel = computed(() => {
  if (loading.value) return '生成中…'
  if (hasUploadedRef.value) return '基于参考图生成'
  if (isFollowUp.value) return '继续修改'
  return '生成图片'
})

const loaderAspectRatio = computed(() => {
  const [w, h] = size.value.split('x').map(Number)
  return `${w} / ${h}`
})

const refHint = computed(() => {
  if (hasUploadedRef.value && isFollowUp.value) {
    return '已上传参考图，将优先于上一轮结果作为底图'
  }
  if (hasUploadedRef.value) return '将基于上传的参考图生成'
  if (isFollowUp.value) return '将基于上一张生成图继续修改'
  if (turns.value.length) return '历史图片未缓存，可上传参考图后继续改图'
  return ''
})

const hasHistory = computed(() => sessions.value.length > 0)

function restoreHistoryOnMount() {
  sessions.value = loadSessions()
  const activeId = loadActiveSessionId()
  const target =
    (activeId && sessions.value.find((s) => s.id === activeId)) ?? sessions.value[0]
  if (!target) return
  activeSessionId.value = target.id
  turns.value = cloneTurns(target.turns)
  size.value = target.size
}

function persistCurrentSession(options?: { silent?: boolean }) {
  if (!getStorableTurns(turns.value).length) return

  const { sessions: next, activeId } = upsertSession(sessions.value, {
    id: activeSessionId.value,
    turns: turns.value,
    size: size.value,
  })
  if (!activeId) return
  const result = saveSessions(next)
  if (!result.ok) {
    if (!options?.silent) {
      error.value = result.error
    }
    return
  }
  saveActiveSessionId(activeId)
  sessions.value = result.sessions
  activeSessionId.value = activeId
  if (result.stripped && !options?.silent) {
    error.value = '本地存储空间不足，已仅保存文字对话（图片未写入历史）'
  }
}

function onBeforeUnload() {
  if (loading.value || !getStorableTurns(turns.value).length) return
  persistCurrentSession({ silent: true })
}

function loadSession(id: string) {
  if (loading.value) return
  if (activeSessionId.value !== id && getStorableTurns(turns.value).length) {
    persistCurrentSession({ silent: true })
  }

  sessions.value = loadSessions()
  const session = sessions.value.find((s) => s.id === id)
  if (!session) return

  activeSessionId.value = session.id
  saveActiveSessionId(session.id)
  turns.value = cloneTurns(session.turns)
  size.value = session.size
  prompt.value = ''
  error.value = null
  clearReference()
  historyOpen.value = false
  scrollThreadToEnd()
}

function deleteSession(id: string, e?: Event) {
  e?.stopPropagation()
  const next = sessions.value.filter((s) => s.id !== id)
  const result = saveSessions(next)
  if (!result.ok) {
    error.value = result.error
    return
  }
  sessions.value = result.sessions
  if (activeSessionId.value === id) {
    activeSessionId.value = null
    saveActiveSessionId(null)
    turns.value = []
  }
}

function clearAllHistory() {
  if (!confirm('确定清空全部历史记录？此操作不可恢复。')) return
  saveSessions([])
  saveActiveSessionId(null)
  sessions.value = []
  activeSessionId.value = null
  turns.value = []
  historyOpen.value = false
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) apiKey.value = saved
  restoreHistoryOnMount()
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('paste', onPaste, true)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('paste', onPaste, true)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightboxSrc.value) {
    lightboxSrc.value = null
  }
}

function persistKey() {
  if (rememberKey.value && apiKey.value.trim()) {
    localStorage.setItem(STORAGE_KEY, apiKey.value.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function openLightbox(src: string) {
  lightboxSrc.value = src
}

function pickReferenceFile() {
  fileInputRef.value?.click()
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  // 截图粘贴时 type 可能为空
  return file.type === '' && file.size > 0
}

function getImageFromClipboard(dt: DataTransfer | null): File | null {
  if (!dt) return null

  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const file = dt.files[i]
      if (isImageFile(file)) return file
    }
  }

  for (const item of dt.items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file && isImageFile(file)) return file
  }

  return null
}

function loadReferenceFile(file: File) {
  if (!isImageFile(file)) {
    error.value = '请选择图片文件'
    return
  }
  if (file.size > MAX_REF_MB * 1024 * 1024) {
    error.value = `参考图请小于 ${MAX_REF_MB}MB`
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    referenceImageSrc.value = reader.result as string
    error.value = null
  }
  reader.onerror = () => {
    error.value = '读取图片失败'
  }
  reader.readAsDataURL(file)
}

function onReferenceFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) loadReferenceFile(file)
}

function onPaste(e: ClipboardEvent) {
  if (loading.value) return

  const file = getImageFromClipboard(e.clipboardData)
  if (!file) return

  e.preventDefault()
  e.stopPropagation()
  loadReferenceFile(file)
}

function onRefDragEnter() {
  if (loading.value) return
  refDragDepth.value++
  refDropActive.value = true
}

function onRefDragLeave() {
  refDragDepth.value = Math.max(0, refDragDepth.value - 1)
  if (refDragDepth.value === 0) refDropActive.value = false
}

function onRefDrop(e: DragEvent) {
  refDragDepth.value = 0
  refDropActive.value = false
  if (loading.value) return
  const file = e.dataTransfer?.files?.[0]
  if (file) loadReferenceFile(file)
}

function clearReference() {
  referenceImageSrc.value = null
}

function newChat() {
  if (loading.value) return
  persistCurrentSession()
  activeSessionId.value = null
  saveActiveSessionId(null)
  turns.value = []
  prompt.value = ''
  error.value = null
  clearReference()
}

async function scrollThreadToEnd() {
  await nextTick()
  const el = threadRef.value
  if (!el) return
  const last = el.lastElementChild
  if (last) {
    last.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

function resolveReferenceImage(): string | undefined {
  if (referenceImageSrc.value) return referenceImageSrc.value
  return lastImageSrc.value ?? undefined
}

async function onSubmit() {
  if (!canSubmit.value) return

  persistKey()
  const text = prompt.value.trim()
  const referenceImage = resolveReferenceImage()
  const usedUploadRef = Boolean(
    referenceImageSrc.value && referenceImage === referenceImageSrc.value,
  )
  prompt.value = ''
  error.value = null
  loading.value = true

  const userTurn: ChatTurn = {
    id: crypto.randomUUID(),
    role: 'user',
    prompt: text,
    referenceImageSrc: usedUploadRef ? referenceImageSrc.value! : undefined,
  }
  const assistantId = crypto.randomUUID()
  turns.value.push(userTurn, {
    id: assistantId,
    role: 'assistant',
    pending: true,
  })
  persistCurrentSession({ silent: true })
  await scrollThreadToEnd()

  try {
    const res = await generateImage({
      prompt: text,
      size: size.value,
      apiKey: effectiveApiKey.value,
      referenceImage,
    })
    const item = res.data[0]
    const src = imageItemToSrc(item)
    if (!src) throw new Error('无法解析返回的图片')

    const idx = turns.value.findIndex((t) => t.id === assistantId)
    if (idx !== -1) {
      turns.value[idx] = {
        id: assistantId,
        role: 'assistant',
        imageSrc: src,
        revisedPrompt: item.revised_prompt,
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '生成失败'
    error.value = msg
    const idx = turns.value.findIndex((t) => t.id === assistantId)
    if (idx !== -1) {
      turns.value[idx] = { id: assistantId, role: 'assistant', error: msg }
    }
  } finally {
    loading.value = false
    persistCurrentSession()
    await scrollThreadToEnd()
  }
}

function downloadImage(src: string, e?: Event) {
  e?.stopPropagation()
  const a = document.createElement('a')
  a.href = src
  a.download = `agnes-${Date.now()}.png`
  a.rel = 'noopener'
  if (src.startsWith('http')) {
    a.target = '_blank'
  }
  a.click()
}
</script>

<template>
  <div class="gen">
    <section class="gen__panel">
      <form class="gen__form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="field__label-row">
            <span class="field__label">API Key</span>
            <a
              :href="API_KEYS_URL"
              class="field__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              前往官网获取 Key →
            </a>
          </span>
          <input
            v-model="apiKey"
            class="field__input"
            type="password"
            placeholder="粘贴从 Agnes 平台复制的 API Key"
            autocomplete="off"
          />
        </label>

        <label class="field field--row">
          <input v-model="rememberKey" type="checkbox" class="field__check" />
          <span class="field__hint">记住 Key（仅存于本机 localStorage）</span>
        </label>

        <div class="history field">
          <div class="history__head">
            <span class="field__label">历史记录</span>
            <button
              type="button"
              class="history__toggle"
              :disabled="loading"
              @click="historyOpen = !historyOpen"
            >
              {{ historyOpen ? '收起' : hasHistory ? `查看 (${sessions.length})` : '暂无' }}
            </button>
          </div>
          <div v-if="historyOpen" class="history__panel">
            <p v-if="!hasHistory" class="field__hint">生成后会自动保存到本机</p>
            <p v-else class="field__hint history__hint">
              点击加载后可继续改图；有缓存图片时将自动作为底图
            </p>
            <ul v-if="hasHistory" class="history__list">
              <li
                v-for="session in sessions"
                :key="session.id"
                class="history__item"
                :class="{ 'history__item--active': session.id === activeSessionId }"
              >
                <button
                  type="button"
                  class="history__load"
                  :disabled="loading"
                  @click="loadSession(session.id)"
                >
                  <span class="history__title">{{ session.title }}</span>
                  <span class="history__meta">
                    {{ userTurnCount(session.turns) }} 轮 · {{ formatSessionTime(session.updatedAt) }}
                    <span
                      v-if="lastAssistantImageSrc(session.turns)"
                      class="history__continue"
                    >
                      可继续改图
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  class="history__delete"
                  :disabled="loading"
                  aria-label="删除"
                  @click="deleteSession(session.id, $event)"
                >
                  ×
                </button>
              </li>
            </ul>
            <button
              v-if="hasHistory"
              type="button"
              class="history__clear"
              :disabled="loading"
              @click="clearAllHistory"
            >
              清空全部历史
            </button>
          </div>
        </div>

        <div class="field">
          <span class="field__label">参考图（可选）</span>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="field__file"
            @change="onReferenceFileChange"
          />
          <div
            class="ref-drop"
            :class="{ 'ref-drop--active': refDropActive }"
            tabindex="0"
            @dragenter.prevent="onRefDragEnter"
            @dragover.prevent
            @dragleave.prevent="onRefDragLeave"
            @drop.prevent="onRefDrop"
            @paste="onPaste"
          >
            <div class="ref">
              <button
                type="button"
                class="gen__secondary ref__pick"
                :disabled="loading"
                @click="pickReferenceFile"
              >
                上传参考图
              </button>
              <button
                v-if="hasUploadedRef"
                type="button"
                class="gen__secondary"
                :disabled="loading"
                @click="clearReference"
              >
                移除
              </button>
            </div>
            <p class="ref-drop__hint">
              拖拽到此处，或按 Ctrl+V / ⌘V 粘贴图片（含截图）；点击此区域后粘贴更稳定
            </p>
            <div v-if="hasUploadedRef" class="ref__preview">
              <img
                :src="referenceImageSrc!"
                alt="参考图预览"
                class="ref__thumb img--zoomable"
                title="点击放大"
                @click="openLightbox(referenceImageSrc!)"
              />
              <span class="field__hint">点击预览可放大</span>
            </div>
          </div>
        </div>

        <label v-if="!isFollowUp" class="field">
          <span class="field__label">尺寸</span>
          <select v-model="size" class="field__input field__select">
            <option v-for="opt in sizeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <p v-if="refHint" class="field__hint field__hint--block">
          {{ refHint }}
        </p>

        <label class="field">
          <span class="field__label">
            {{ isImg2Img ? '修改说明 / 提示词' : '提示词' }}
          </span>
          <textarea
            v-model="prompt"
            class="field__input field__textarea"
            rows="3"
            :placeholder="
              isImg2Img
                ? '描述要如何改图或生成效果，例如：保留人物，改成水彩插画风格'
                : '描述你想生成的画面，例如：晨雾峡谷上空的发光浮城，电影感写实'
            "
            required
          />
        </label>

        <div class="gen__actions">
          <button class="gen__submit" type="submit" :disabled="!canSubmit">
            {{ submitLabel }}
          </button>
          <button
            v-if="turns.length || hasUploadedRef"
            type="button"
            class="gen__secondary"
            :disabled="loading"
            @click="newChat"
          >
            新对话
          </button>
        </div>

        <p v-if="error" class="gen__error" role="alert">{{ error }}</p>
      </form>
    </section>

    <section class="gen__thread-wrap">
      <div ref="threadRef" class="gen__thread">
        <div v-if="!turns.length" class="gen__placeholder gen__placeholder--idle">
          <p>对话记录将显示在这里</p>
          <p class="gen__placeholder-sub">
            可上传参考图改图，或生成后继续对话修改；点击图片可放大
          </p>
        </div>

        <article
          v-for="turn in turns"
          :key="turn.id"
          class="turn"
          :class="`turn--${turn.role}`"
        >
          <ChatAvatar :role="turn.role" />

          <div class="turn__body">
            <div v-if="turn.role === 'user'" class="turn__user">
              <p class="turn__prompt">{{ turn.prompt }}</p>
              <img
                v-if="turn.referenceImageSrc"
                :src="turn.referenceImageSrc"
                alt="本轮参考图"
                class="turn__ref-thumb img--zoomable"
                title="点击放大"
                @click="openLightbox(turn.referenceImageSrc)"
              />
            </div>

            <template v-else>
              <div v-if="turn.pending" class="turn__pending">
                <DotGridLoader :aspect-ratio="loaderAspectRatio" />
              </div>
              <p v-else-if="turn.error" class="turn__error">{{ turn.error }}</p>
              <div v-else-if="turn.imageSrc" class="turn__result">
                <img
                  :src="turn.imageSrc"
                  alt="生成的图片"
                  class="turn__img turn__img--reveal img--zoomable"
                  title="点击放大"
                  @click="openLightbox(turn.imageSrc)"
                />
                <button
                  type="button"
                  class="gen__download"
                  @click="downloadImage(turn.imageSrc, $event)"
                >
                  下载
                </button>
              </div>
              <p v-else-if="turn.revisedPrompt" class="turn__revised">{{ turn.revisedPrompt }}</p>
              <p v-else class="turn__missing">图片未缓存到本地，请重新生成</p>
            </template>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <ImageLightbox v-if="lightboxSrc" :src="lightboxSrc" @close="lightboxSrc = null" />
    </Teleport>
  </div>
</template>

<style scoped>
.gen {
  display: grid;
  gap: 1.5rem;
  width: 100%;
  min-width: 0;
}

@media (max-width: 839px) {
  .turn--user {
    max-width: 100%;
  }
}

@media (min-width: 840px) {
  .gen {
    grid-template-columns: minmax(280px, 360px) 1fr;
    align-items: start;
  }
}

.gen__panel,
.gen__thread-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem 1.35rem;
}

.gen__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field--row {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.field__label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.field__link {
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s;
}

.field__link:hover {
  color: var(--text);
  text-decoration: underline;
}

.field__hint {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.field__hint--block {
  margin: 0;
  padding: 0.5rem 0.65rem;
  background: var(--surface-raised);
  border-radius: 6px;
  border: 1px solid var(--border);
}

.field__file {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.field__input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
}

.field__input:focus {
  border-color: var(--accent-dim);
}

.field__textarea {
  resize: vertical;
  min-height: 88px;
}

.field__select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239a8f82'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2rem;
}

.field__check {
  width: 1rem;
  height: 1rem;
  accent-color: var(--accent);
}

.ref-drop {
  padding: 0.75rem;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  outline: none;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.ref-drop:focus-visible {
  border-color: var(--accent-dim);
}

.ref-drop--active {
  border-color: var(--accent);
  background: rgba(212, 168, 120, 0.08);
}

.ref-drop__hint {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.ref {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ref__pick {
  flex: 1;
  min-width: 120px;
}

.ref__preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
}

.ref__thumb {
  max-width: 100%;
  max-height: 140px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.img--zoomable {
  cursor: zoom-in;
  transition: box-shadow 0.15s, transform 0.15s;
}

.img--zoomable:hover {
  box-shadow: 0 0 0 2px var(--accent-dim);
}

.gen__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.history__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.history__toggle {
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.history__toggle:hover:not(:disabled) {
  border-color: var(--accent-dim);
  color: var(--text);
}

.history__panel {
  margin-top: 0.35rem;
  padding: 0.65rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 220px;
  overflow-y: auto;
}

.history__item {
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
  border-radius: 6px;
  border: 1px solid transparent;
}

.history__item--active {
  border-color: var(--accent-dim);
  background: rgba(212, 168, 120, 0.08);
}

.history__load {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
}

.history__load:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.03);
}

.history__title {
  display: block;
  font-size: 0.84rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history__meta {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.history__hint {
  margin: 0 0 0.5rem;
}

.history__continue {
  margin-left: 0.35rem;
  color: var(--accent);
}

.history__delete {
  flex-shrink: 0;
  width: 2rem;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
}

.history__delete:hover:not(:disabled) {
  color: var(--danger);
  background: rgba(224, 122, 106, 0.1);
}

.history__clear {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.45rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 6px;
}

.history__clear:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
}

.gen__submit {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1.25rem;
  font-weight: 600;
  color: var(--bg);
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  border: none;
  border-radius: 6px;
  transition: filter 0.15s, transform 0.1s;
}

.gen__submit:hover:not(:disabled) {
  filter: brightness(1.06);
}

.gen__submit:active:not(:disabled) {
  transform: scale(0.99);
}

.gen__secondary {
  padding: 0.75rem 1rem;
  font-size: 0.88rem;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: border-color 0.15s, color 0.15s;
}

.gen__secondary:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--accent-dim);
}

.gen__error {
  margin: 0;
  font-size: 0.88rem;
  color: var(--danger);
}

/* 默认（移动端）：随内容撑开，无内部滚动条 */
.gen__thread-wrap {
  display: flex;
  flex-direction: column;
  padding: 0;
  min-width: 0;
  min-height: auto;
  max-height: none;
  overflow: visible;
}

.gen__thread {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  padding: 0.75rem 0;
  overflow: visible;
}

@media (max-width: 839px) {
  .gen__panel,
  .gen__thread-wrap {
    padding: 1rem;
  }
}

@media (min-width: 840px) {
  .gen__thread-wrap {
    min-height: 360px;
    max-height: min(72vh, 720px);
    overflow: hidden;
  }

  .gen__thread {
    flex: 1;
    min-height: 0;
    padding: 1rem 1.15rem;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

.gen__placeholder {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 0;
}

.gen__placeholder--idle {
  opacity: 0.7;
}

.gen__placeholder-sub {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
}

.turn {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
}

.turn--user {
  flex-direction: row-reverse;
  align-self: flex-end;
  max-width: 100%;
}

.turn--assistant {
  align-self: flex-start;
}

.turn__body {
  flex: 1;
  min-width: 0;
}

.turn__user {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
}

.turn__prompt {
  margin: 0;
  padding: 0.6rem 0.85rem;
  font-size: 0.92rem;
  line-height: 1.45;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 16px 16px 6px 16px;
  color: var(--text);
}

.turn__ref-thumb {
  max-width: 120px;
  max-height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.turn__pending {
  width: 100%;
}

.turn__img--reveal {
  animation: img-reveal 0.55s ease-out both;
}

@keyframes img-reveal {
  from {
    opacity: 0;
    filter: blur(6px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

.turn__error {
  margin: 0;
  font-size: 0.88rem;
  color: var(--danger);
}

.turn__revised {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.turn__missing {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
  font-style: italic;
}

.turn__result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.turn__img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 28px;
  border: 1px solid var(--border);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

.gen__download {
  padding: 0.4rem 0.85rem;
  font-size: 0.82rem;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: background 0.15s, border-color 0.15s;
}

.gen__download:hover {
  background: var(--surface-raised);
  border-color: var(--accent-dim);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
