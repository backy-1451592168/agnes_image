<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { generateImage, imageItemToSrc } from '../api/agnes'
import ImageLightbox from './ImageLightbox.vue'
import type { ChatTurn, ImageSize } from '../types/agnes'

const STORAGE_KEY = 'agnes_api_key'
const MAX_REF_MB = 8

const apiKey = ref('')
const rememberKey = ref(true)
const prompt = ref('')
const size = ref<ImageSize>('1024x768')
const loading = ref(false)
const error = ref<string | null>(null)
const turns = ref<ChatTurn[]>([])
const threadRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const referenceImageSrc = ref<string | null>(null)
const lightboxSrc = ref<string | null>(null)

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

const lastImageSrc = computed(() => {
  for (let i = turns.value.length - 1; i >= 0; i--) {
    const t = turns.value[i]
    if (t.role === 'assistant' && t.imageSrc) return t.imageSrc
  }
  return null
})

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

const refHint = computed(() => {
  if (hasUploadedRef.value && isFollowUp.value) {
    return '已上传参考图，将优先于上一轮结果作为底图'
  }
  if (hasUploadedRef.value) return '将基于上传的参考图生成'
  if (isFollowUp.value) return '将基于上一张生成图继续修改'
  return ''
})

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) apiKey.value = saved
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
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

function onReferenceFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
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

function clearReference() {
  referenceImageSrc.value = null
}

function newChat() {
  if (loading.value) return
  turns.value = []
  prompt.value = ''
  error.value = null
  clearReference()
}

async function scrollThreadToEnd() {
  await nextTick()
  threadRef.value?.scrollTo({ top: threadRef.value.scrollHeight, behavior: 'smooth' })
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
  await scrollThreadToEnd()

  try {
    const res = await generateImage({
      prompt: text,
      size: size.value,
      apiKey: effectiveApiKey.value,
      referenceImage,
    })
    const src = imageItemToSrc(res.data[0])
    if (!src) throw new Error('无法解析返回的图片')

    const idx = turns.value.findIndex((t) => t.id === assistantId)
    if (idx !== -1) {
      turns.value[idx] = { id: assistantId, role: 'assistant', imageSrc: src }
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
          <span class="field__label">API Key</span>
          <input
            v-model="apiKey"
            class="field__input"
            type="password"
            placeholder="在 platform.agnes-ai.com 创建"
            autocomplete="off"
          />
        </label>

        <label class="field field--row">
          <input v-model="rememberKey" type="checkbox" class="field__check" />
          <span class="field__hint">记住 Key（仅存于本机 localStorage）</span>
        </label>

        <div class="field">
          <span class="field__label">参考图（可选）</span>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="field__file"
            @change="onReferenceFileChange"
          />
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

        <label v-if="!isFollowUp" class="field">
          <span class="field__label">尺寸</span>
          <select v-model="size" class="field__input field__select">
            <option v-for="opt in sizeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <p v-else-if="refHint" class="field__hint field__hint--block">
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
              <span class="gen__spinner" aria-hidden="true" />
              <span>生成中…</span>
            </div>
            <p v-else-if="turn.error" class="turn__error">{{ turn.error }}</p>
            <div v-else-if="turn.imageSrc" class="turn__result">
              <img
                :src="turn.imageSrc"
                alt="生成的图片"
                class="turn__img img--zoomable"
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
          </template>
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

.gen__thread-wrap {
  min-height: 360px;
  max-height: min(72vh, 720px);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.gen__thread {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.gen__spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.turn--user {
  align-self: flex-end;
  max-width: 92%;
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
  border-radius: 10px 10px 4px 10px;
  color: var(--text);
}

.turn__ref-thumb {
  max-width: 120px;
  max-height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.turn--assistant {
  align-self: flex-start;
  max-width: 100%;
}

.turn__pending {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.turn__error {
  margin: 0;
  font-size: 0.88rem;
  color: var(--danger);
}

.turn__result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.turn__img {
  max-width: 100%;
  border-radius: 6px;
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
