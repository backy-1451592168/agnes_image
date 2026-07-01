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
import { randomId } from '../utils/randomId'

const props = defineProps<{
  apiKey: string
  baseUrl: string
  model: string
}>()

const MAX_REF_MB = 8

const prompt = ref('')
const size = ref<ImageSize>('1024x768')
const loading = ref(false)
const error = ref<string | null>(null)
const turns = ref<ChatTurn[]>([])
const sessions = ref<ChatSession[]>([])
const activeSessionId = ref<string | null>(null)
const threadRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const referenceImageSrc = ref<string | null>(null)
const lightboxSrc = ref<string | null>(null)
const refDropActive = ref(false)
const refDragDepth = ref(0)

const sizeOptions: { value: ImageSize; label: string }[] = [
  { value: '1024x768', label: '横图' },
  { value: '1024x1024', label: '方图' },
  { value: '1024x1536', label: '竖图' },
]

const effectiveApiKey = computed(() => props.apiKey.trim())

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

const composerHint = computed(() => {
  if (hasUploadedRef.value && isFollowUp.value) {
    return '参考图优先于上一轮结果'
  }
  if (isFollowUp.value) return '将基于上一张图继续修改'
  return ''
})

const hasHistory = computed(() => sessions.value.length > 0)

const lastFailedAssistantId = computed(() => {
  const last = turns.value[turns.value.length - 1]
  return last?.role === 'assistant' && last.error ? last.id : null
})

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
}

onMounted(() => {
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

function openLightbox(src: string) {
  lightboxSrc.value = src
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

function onComposerKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (canSubmit.value) onSubmit()
  }
}

function openFilePicker() {
  if (loading.value) return
  fileInputRef.value?.click()
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

async function fulfillGeneration(
  assistantId: string,
  text: string,
  referenceImage: string | undefined,
) {
  loading.value = true
  error.value = null

  const idx = turns.value.findIndex((t) => t.id === assistantId)
  if (idx !== -1) {
    turns.value[idx] = { id: assistantId, role: 'assistant', pending: true }
  }

  try {
    const res = await generateImage({
      prompt: text,
      size: size.value,
      apiKey: effectiveApiKey.value,
      baseUrl: props.baseUrl,
      model: props.model,
      referenceImage,
    })
    const item = res.data[0]
    const src = imageItemToSrc(item)
    if (!src) throw new Error('无法解析返回的图片')

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
    if (idx !== -1) {
      turns.value[idx] = { id: assistantId, role: 'assistant', error: msg }
    }
  } finally {
    loading.value = false
    persistCurrentSession()
    await scrollThreadToEnd()
  }
}

async function retryGeneration(assistantId: string) {
  if (loading.value) return

  const asstIdx = turns.value.findIndex((t) => t.id === assistantId)
  if (asstIdx <= 0) return

  const user = turns.value[asstIdx - 1]
  if (user?.role !== 'user' || !user.prompt?.trim()) return

  const text = user.prompt.trim()
  const referenceImage =
    user.referenceImageSrc ??
    lastAssistantImageSrc(turns.value.slice(0, asstIdx - 1)) ??
    undefined

  await fulfillGeneration(assistantId, text, referenceImage)
}

async function onSubmit() {
  if (!canSubmit.value) return

  const text = prompt.value.trim()
  const referenceImage = resolveReferenceImage()
  const uploadedReferenceImage = referenceImageSrc.value
  const usedUploadRef = Boolean(uploadedReferenceImage && referenceImage === uploadedReferenceImage)
  prompt.value = ''

  const userTurn: ChatTurn = {
    id: randomId(),
    role: 'user',
    prompt: text,
    referenceImageSrc: usedUploadRef ? uploadedReferenceImage! : undefined,
  }
  const assistantId = randomId()
  turns.value.push(userTurn, {
    id: assistantId,
    role: 'assistant',
    pending: true,
  })
  if (usedUploadRef) clearReference()
  persistCurrentSession({ silent: true })
  await scrollThreadToEnd()

  await fulfillGeneration(assistantId, text, referenceImage)
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
    <aside class="gen__sidebar" aria-label="历史记录">
      <button
        type="button"
        class="sidebar__new"
        :disabled="loading"
        @click="newChat"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            d="M12 5v14M5 12h14"
          />
        </svg>
        新对话
      </button>

      <div class="sidebar__scroll">
        <p v-if="!hasHistory" class="sidebar__empty">生成后自动保存到本机</p>
        <ul v-else class="history__list">
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
                <span v-if="lastAssistantImageSrc(session.turns)" class="history__continue">
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
      </div>

      <button
        v-if="hasHistory"
        type="button"
        class="history__clear"
        :disabled="loading"
        @click="clearAllHistory"
      >
        清空全部历史
      </button>
    </aside>

    <section class="gen__main">
      <div v-if="error" class="gen__error-wrap" role="alert">
        <p class="gen__error" :title="error">{{ error }}</p>
          <button
            v-if="lastFailedAssistantId"
            type="button"
            class="gen__retry"
            :disabled="loading"
            aria-label="重试生成"
            @click="retryGeneration(lastFailedAssistantId)"
          >
            <svg class="gen__retry-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M23 4v6h-6"
              />
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
              />
            </svg>
          </button>
        </div>

      <div ref="threadRef" class="gen__thread">
        <div v-if="!turns.length" class="gen__placeholder gen__placeholder--idle">
          <p>对话记录将显示在这里</p>
          <p class="gen__placeholder-sub">输入描述生成图片，点 + 或粘贴图片作为参考；Enter 发送</p>
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
              <div v-else-if="turn.error" class="turn__error-wrap">
                <p class="turn__error" :title="turn.error">{{ turn.error }}</p>
                <button
                  type="button"
                  class="turn__retry"
                  :disabled="loading"
                  aria-label="重试生成"
                  @click="retryGeneration(turn.id)"
                >
                  <svg class="turn__retry-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M23 4v6h-6"
                    />
                    <path
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
                    />
                  </svg>
                </button>
              </div>
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

      <form class="gen__composer" @submit.prevent="onSubmit">
        <div
          class="composer"
          :class="{ 'composer--drag': refDropActive }"
          @dragenter.prevent="onRefDragEnter"
          @dragover.prevent
          @dragleave.prevent="onRefDragLeave"
          @drop.prevent="onRefDrop"
        >
          <div v-if="hasUploadedRef" class="composer__attachments">
            <div class="composer__attachment">
              <button
                type="button"
                class="composer__attachment-thumb"
                title="点击放大"
                @click="openLightbox(referenceImageSrc!)"
              >
                <img :src="referenceImageSrc!" alt="参考图" />
              </button>
              <button
                type="button"
                class="composer__attachment-remove"
                aria-label="移除参考图"
                :disabled="loading"
                @click="clearReference"
              >
                ×
              </button>
            </div>
          </div>

          <div class="composer__row">
            <button
              type="button"
              class="composer__attach"
              aria-label="上传参考图"
              :disabled="loading"
              @click="openFilePicker"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  d="M12 5v14M5 12h14"
                />
              </svg>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="composer__file"
              :disabled="loading"
              @change="onReferenceFileChange"
            />
            <textarea
              v-model="prompt"
              class="composer__input"
              rows="1"
              :placeholder="
                isImg2Img
                  ? '描述要如何改图，可点 + 或粘贴图片作为参考'
                  : '描述你想生成的画面，可点 + 或粘贴图片'
              "
              :disabled="loading"
              required
              @keydown="onComposerKeydown"
              @paste="onPaste"
            />
          </div>

          <div class="composer__footer">
            <div class="composer__meta">
              <select
                v-if="!isFollowUp"
                v-model="size"
                class="composer__size"
                :disabled="loading"
              >
                <option v-for="opt in sizeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <span v-else class="composer__mode">改图</span>
              <span v-if="composerHint" class="composer__hint">{{ composerHint }}</span>
            </div>
            <div class="composer__actions">
              <button
                type="submit"
                class="composer__send"
                :disabled="!canSubmit"
                :aria-label="submitLabel"
                :title="submitLabel"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 19V5M5 12l7-7 7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>

    <Teleport to="body">
      <ImageLightbox v-if="lightboxSrc" :src="lightboxSrc" @close="lightboxSrc = null" />
    </Teleport>
  </div>
</template>

<style scoped>
.gen {
  display: flex;
  gap: 1rem;
  width: 100%;
  min-width: 0;
  flex: 1;
  min-height: 0;
}

.gen__sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 240px;
  min-height: 0;
  padding: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.sidebar__new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.sidebar__new svg {
  width: 1rem;
  height: 1rem;
  color: var(--accent);
}

.sidebar__new:hover:not(:disabled) {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.sidebar__scroll {
  flex: 1;
  min-height: 0;
  margin-top: 0.75rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.sidebar__empty {
  margin: 0;
  padding: 0.5rem 0.25rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.gen__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem 1.35rem;
}

@media (min-width: 840px) {
  .gen__sidebar {
    max-height: 100%;
    align-self: stretch;
  }
}

@media (max-width: 839px) {
  .gen {
    flex-direction: column;
    gap: 0.75rem;
  }

  .gen__sidebar {
    width: 100%;
    max-height: 200px;
  }
}

@media (max-width: 839px) {
  .turn--user {
    max-width: 100%;
  }

  .gen__main {
    padding: 1rem;
  }

  .gen__error-wrap,
  .turn__error-wrap {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    max-width: 100%;
  }

  .gen__error,
  .turn__error {
    flex: 1;
    min-width: 0;
    font-size: 0.78rem;
    line-height: 1.35;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .gen__retry,
  .turn__retry {
    width: 1.75rem;
    height: 1.75rem;
  }
}

@media (min-width: 840px) {
  .gen__main {
    flex: 1;
    overflow: hidden;
  }
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

.field__input-wrap {
  position: relative;
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

.field__input--action {
  padding-right: 2.75rem;
}

.field__toggle {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--text-muted);
  background: none;
  border: none;
  border-radius: 4px;
  transform: translateY(-50%);
  cursor: pointer;
}

.field__toggle:hover {
  color: var(--accent);
}

.field__toggle:focus-visible {
  outline: 2px solid var(--accent-dim);
  outline-offset: 1px;
}

.field__toggle-icon {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
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

.img--zoomable {
  cursor: zoom-in;
  transition: box-shadow 0.15s, transform 0.15s;
}

.img--zoomable:hover {
  box-shadow: 0 0 0 2px var(--accent-dim);
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
  flex-shrink: 0;
  width: 100%;
  margin-top: 0.65rem;
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

.gen__error-wrap,
.turn__error-wrap {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  max-width: 100%;
}

.gen__error,
.turn__error {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 0.88rem;
  color: var(--danger);
  line-height: 1.45;
}

.gen__retry,
.turn__retry {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--text-muted);
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.gen__retry:hover:not(:disabled),
.turn__retry:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent-dim);
}

.gen__retry:disabled,
.turn__retry:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.gen__retry-icon,
.turn__retry-icon {
  display: block;
  width: 1.05rem;
  height: 1.05rem;
}

/* 对话区：占满中间空间，避免被底部输入区挤没 */
.gen__thread {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1 1 auto;
  min-width: 0;
  min-height: clamp(220px, 34vh, 520px);
  padding: 0.75rem 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 839px) {
  .gen__main {
    padding: 1rem;
  }
}

@media (min-width: 840px) {
  .gen__thread {
    flex: 1 1 0;
    padding: 0 0 0.5rem;
  }
}

.gen__composer {
  flex-shrink: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--border);
}

.composer {
  border: 1px solid var(--border);
  border-radius: 1.35rem;
  background: var(--surface-raised);
  padding: 0.55rem 0.65rem 0.5rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.composer:focus-within {
  border-color: var(--accent-dim);
  box-shadow: 0 0 0 1px rgba(212, 168, 120, 0.12);
}

.composer--drag {
  border-color: var(--accent);
  background: rgba(212, 168, 120, 0.06);
}

.composer__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.15rem 0.35rem 0.5rem;
}

.composer__attachment {
  position: relative;
}

.composer__attachment-thumb {
  display: block;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: none;
  cursor: zoom-in;
}

.composer__attachment-thumb img {
  display: block;
  width: 56px;
  height: 56px;
  object-fit: cover;
}

.composer__attachment-remove {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  font-size: 0.9rem;
  line-height: 1;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
}

.composer__attachment-remove:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
}

.composer__row {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
}

.composer__attach {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-bottom: 0.1rem;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 50%;
}

.composer__attach:hover:not(:disabled) {
  color: var(--accent);
  background: rgba(212, 168, 120, 0.1);
}

.composer__attach svg {
  width: 1.15rem;
  height: 1.15rem;
}

.composer__file {
  display: none;
}

.composer__input {
  flex: 1;
  min-width: 0;
  min-height: 2.25rem;
  max-height: 9rem;
  padding: 0.45rem 0.35rem;
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--text);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  field-sizing: content;
}

.composer__input::placeholder {
  color: var(--text-muted);
}

.composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.2rem 0.15rem 0 0.35rem;
}

.composer__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
}

.composer__size {
  flex-shrink: 0;
  padding: 0.2rem 1.5rem 0.2rem 0.5rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%239a8f82'%3E%3Cpath d='M5 7L1 3h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.2rem center;
}

.composer__size:hover:not(:disabled) {
  color: var(--text);
}

.composer__mode {
  font-size: 0.78rem;
  color: var(--accent);
}

.composer__hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.composer__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  padding: 0;
  color: var(--bg);
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  border: none;
  border-radius: 50%;
  transition: filter 0.15s, transform 0.1s, opacity 0.15s;
}

.composer__send svg {
  width: 1rem;
  height: 1rem;
}

.composer__send:hover:not(:disabled) {
  filter: brightness(1.08);
}

.composer__send:active:not(:disabled) {
  transform: scale(0.96);
}

.composer__send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 839px) {
  .gen__composer {
    padding: 0.65rem 0 0;
  }

  .composer__hint {
    display: none;
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
  margin-right: 10px;
}

.turn--assistant {
  align-self: flex-start;
  max-width: 100%;
}

.turn__body {
  flex: 1;
  min-width: 0;
  max-width: min(100%, 480px);
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
  max-width: 360px;
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
  width: 100%;
  max-width: 480px;
}

.turn__img {
  display: block;
  width: 100%;
  max-width: 480px;
  height: auto;
  border-radius: 16px;
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
