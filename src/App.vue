<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { defaultBaseUrlDisplay, fetchAvailableModels } from './api/agnes'
import DisclaimerModal from './components/DisclaimerModal.vue'
import ImageGenerator from './components/ImageGenerator.vue'
import SettingsModal from './components/SettingsModal.vue'
import { AGNES_IMAGE_MODEL } from './types/agnes'

const DISCLAIMER_KEY = 'agnes_disclaimer_accepted_v1'
const STORAGE_KEY = 'agnes_api_key'
const STORAGE_BASE_KEY = 'agnes_api_base'
const STORAGE_MODEL_KEY = 'agnes_api_model'

const disclaimerOpen = ref(false)
const settingsOpen = ref(false)
const baseUrl = ref(defaultBaseUrlDisplay())
const apiKey = ref('')
const showApiKey = ref(false)
const selectedModel = ref<string>(AGNES_IMAGE_MODEL)
const availableModels = ref<string[]>([])
const loadingModels = ref(false)
const modelsError = ref<string | null>(null)

const effectiveApiKey = computed(() => {
  const fromInput = apiKey.value.trim()
  if (fromInput) return fromInput
  return import.meta.env.VITE_AGNES_API_KEY?.trim() ?? ''
})

const canFetchModels = computed(
  () =>
    !loadingModels.value &&
    baseUrl.value.trim().length > 0 &&
    effectiveApiKey.value.length > 0,
)

function openDisclaimer() {
  disclaimerOpen.value = true
}

function closeDisclaimer() {
  disclaimerOpen.value = false
  localStorage.setItem(DISCLAIMER_KEY, '1')
}

function openSettings() {
  settingsOpen.value = true
}

function closeSettings() {
  settingsOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (settingsOpen.value) closeSettings()
  else if (disclaimerOpen.value) closeDisclaimer()
}

function persistSettings() {
  const key = apiKey.value.trim()
  const base = baseUrl.value.trim()
  const model = selectedModel.value.trim()

  if (key) localStorage.setItem(STORAGE_KEY, key)
  else localStorage.removeItem(STORAGE_KEY)

  if (base) localStorage.setItem(STORAGE_BASE_KEY, base)
  else localStorage.removeItem(STORAGE_BASE_KEY)

  if (model) localStorage.setItem(STORAGE_MODEL_KEY, model)
  else localStorage.removeItem(STORAGE_MODEL_KEY)
}

function restoreSettings() {
  const savedKey = localStorage.getItem(STORAGE_KEY)
  const savedBase = localStorage.getItem(STORAGE_BASE_KEY)
  const savedModel = localStorage.getItem(STORAGE_MODEL_KEY)

  if (savedKey) apiKey.value = savedKey
  if (savedBase) baseUrl.value = savedBase
  if (savedModel) selectedModel.value = savedModel
}

async function onFetchModels() {
  if (!canFetchModels.value) return

  loadingModels.value = true
  modelsError.value = null

  try {
    const models = await fetchAvailableModels(baseUrl.value, effectiveApiKey.value)
    availableModels.value = models

    if (models.includes(selectedModel.value)) return

    const imageModel = models.find((id) => id.includes('image'))
    selectedModel.value = imageModel ?? models[0]
  } catch (e) {
    modelsError.value = e instanceof Error ? e.message : '获取模型失败'
  } finally {
    loadingModels.value = false
  }
}

watch([baseUrl, apiKey, selectedModel], persistSettings)

onMounted(() => {
  if (!localStorage.getItem(DISCLAIMER_KEY)) {
    disclaimerOpen.value = true
  }
  restoreSettings()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app">
    <header class="app__top">
      <div class="app__brand">
        <p class="app__eyebrow">{{ selectedModel }}</p>
        <h1 class="app__title">无限想象</h1>
      </div>
      <button
        type="button"
        class="app__settings-btn"
        aria-label="API 设置"
        @click="openSettings"
      >
        <svg class="app__settings-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
          />
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>
    </header>

    <main class="app__main">
      <ImageGenerator
        :api-key="effectiveApiKey"
        :base-url="baseUrl"
        :model="selectedModel"
      />
    </main>

    <footer class="app__footer">
      <p class="app__footer-text">
        请合法合规使用本工具，禁止用于违法违规及侵害他人权益的行为。
        <button type="button" class="app__footer-link" @click="openDisclaimer">
          查看完整用户须知与免责声明
        </button>
      </p>
    </footer>

    <SettingsModal
      :open="settingsOpen"
      :base-url="baseUrl"
      :api-key="apiKey"
      :show-api-key="showApiKey"
      :selected-model="selectedModel"
      :available-models="availableModels"
      :loading-models="loadingModels"
      :models-error="modelsError"
      :can-fetch-models="canFetchModels"
      @close="closeSettings"
      @update:base-url="baseUrl = $event"
      @update:api-key="apiKey = $event"
      @update:show-api-key="showApiKey = $event"
      @update:selected-model="selectedModel = $event"
      @fetch-models="onFetchModels"
    />

    <DisclaimerModal :open="disclaimerOpen" @close="closeDisclaimer" />
  </div>
</template>

<style scoped>
.app {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.app__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.app__brand {
  min-width: 0;
}

.app__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.app__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 400;
  font-style: italic;
  line-height: 1.1;
  color: var(--text);
}

.app__settings-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.app__settings-btn:hover {
  color: var(--accent);
  border-color: var(--accent-dim);
}

.app__settings-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.app__main {
  display: block;
}

.app__footer {
  margin-top: 2.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
  text-align: center;
}

.app__footer-text {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.app__footer-link {
  display: inline;
  margin: 0;
  padding: 0;
  font-size: inherit;
  font-weight: 500;
  color: var(--accent);
  background: none;
  border: none;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.app__footer-link:hover {
  color: var(--text);
}

@media (min-width: 840px) {
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding-bottom: 2rem;
  }

  .app__main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .app__footer {
    flex-shrink: 0;
    margin-top: 1.5rem;
  }
}

@media (max-width: 839px) {
  .app {
    padding: 1.25rem 1rem 2.5rem;
  }

  .app__top {
    margin-bottom: 1.25rem;
  }

  .app__footer {
    margin-top: 1.5rem;
  }
}
</style>
