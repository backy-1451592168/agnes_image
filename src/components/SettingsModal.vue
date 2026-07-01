<script setup lang="ts">
defineProps<{
  open: boolean
  baseUrl: string
  apiKey: string
  showApiKey: boolean
  selectedModel: string
  availableModels: string[]
  loadingModels: boolean
  modelsError: string | null
  canFetchModels: boolean
}>()

const emit = defineEmits<{
  close: []
  'update:baseUrl': [value: string]
  'update:apiKey': [value: string]
  'update:showApiKey': [value: boolean]
  'update:selectedModel': [value: string]
  fetchModels: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      @click.self="emit('close')"
    >
      <div class="settings__panel">
        <header class="settings__head">
          <h2 id="settings-title" class="settings__title">API 设置</h2>
          <button type="button" class="settings__close" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="settings__body">
          <label class="field">
            <span class="field__label">BASE URL</span>
            <input
              :value="baseUrl"
              class="field__input"
              type="url"
              placeholder="https://apihub.agnes-ai.com"
              autocomplete="off"
              spellcheck="false"
              @input="emit('update:baseUrl', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="field">
            <span class="field__label-row">
              <span class="field__label">API KEY</span>
              <a
                href="https://platform.agnes-ai.com/settings/apiKeys"
                class="field__link"
                target="_blank"
                rel="noopener noreferrer"
              >
                前往获取 Key →
              </a>
            </span>
            <div class="field__input-wrap">
              <input
                :value="apiKey"
                class="field__input field__input--action"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="粘贴 API Key"
                autocomplete="off"
                @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                class="field__toggle"
                :aria-label="showApiKey ? '隐藏 API Key' : '显示 API Key'"
                :aria-pressed="showApiKey"
                @click="emit('update:showApiKey', !showApiKey)"
              >
                <svg
                  v-if="!showApiKey"
                  class="field__toggle-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 3l18 18M10.5 10.677a2.25 2.25 0 0 0 3.046 3.046M7.5 7.846c-2.047 1.24-3.5 3.154-4.5 4.154 0 0 3.5 5 9 5 1.55 0 2.96-.38 4.2-.99M14.121 14.121A2.25 2.25 0 0 0 9.88 9.88"
                  />
                </svg>
                <svg v-else class="field__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12s-3.75 7.5-9.75 7.5S2.25 12 2.25 12z"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="2.75"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                  />
                </svg>
              </button>
            </div>
          </label>

          <div class="field">
            <span class="field__label">模型</span>
            <div class="model-row">
              <select
                v-if="availableModels.length"
                :value="selectedModel"
                class="field__input field__select model-row__select"
                @change="emit('update:selectedModel', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="id in availableModels" :key="id" :value="id">
                  {{ id }}
                </option>
              </select>
              <input
                v-else
                :value="selectedModel"
                class="field__input model-row__input"
                type="text"
                placeholder="agnes-image-2.1-flash"
                spellcheck="false"
                @input="emit('update:selectedModel', ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                class="model-row__fetch"
                :disabled="!canFetchModels"
                @click="emit('fetchModels')"
              >
                <svg
                  class="model-row__fetch-icon"
                  :class="{ 'model-row__fetch-icon--spin': loadingModels }"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M23 4v6h-6M1 20v-6h6"
                  />
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                  />
                </svg>
                {{ loadingModels ? '获取中…' : '获取可用模型' }}
              </button>
            </div>
            <p v-if="modelsError" class="field__error" role="alert">{{ modelsError }}</p>
          </div>

          <p class="settings__hint">配置保存在本机浏览器，不会上传到服务器。</p>
        </div>

        <footer class="settings__actions">
          <button type="button" class="settings__ok" @click="emit('close')">完成</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(8, 7, 6, 0.9);
  backdrop-filter: blur(6px);
}

.settings__panel {
  width: min(100%, 480px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.settings__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.settings__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 400;
  font-style: italic;
  line-height: 1.25;
}

.settings__close {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  font-size: 1.35rem;
  line-height: 1;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.settings__close:hover {
  color: var(--text);
  border-color: var(--accent-dim);
}

.settings__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.settings__hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.settings__actions {
  padding: 0.85rem 1.25rem 1.1rem;
  border-top: 1px solid var(--border);
}

.settings__ok {
  width: 100%;
  padding: 0.7rem 1rem;
  font-weight: 600;
  color: var(--bg);
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  border: none;
  border-radius: 6px;
}

.settings__ok:hover {
  filter: brightness(1.06);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.field__link {
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--accent);
  text-decoration: none;
}

.field__link:hover {
  text-decoration: underline;
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

.field__input:focus {
  border-color: var(--accent-dim);
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
}

.field__toggle:hover {
  color: var(--accent);
}

.field__toggle-icon {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
}

.field__select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239a8f82'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2rem;
}

.field__error {
  margin: 0;
  font-size: 0.78rem;
  color: var(--danger);
}

.model-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.model-row__select,
.model-row__input {
  flex: 1;
  min-width: 0;
}

.model-row__fetch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0 0.85rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.model-row__fetch:hover:not(:disabled) {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.model-row__fetch-icon {
  width: 1rem;
  height: 1rem;
}

.model-row__fetch-icon--spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .model-row {
    flex-direction: column;
  }

  .model-row__fetch {
    justify-content: center;
    padding: 0.65rem;
  }
}
</style>
