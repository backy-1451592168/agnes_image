<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import DisclaimerModal from './components/DisclaimerModal.vue'
import ImageGenerator from './components/ImageGenerator.vue'

const DISCLAIMER_KEY = 'agnes_disclaimer_accepted_v1'
const disclaimerOpen = ref(false)

function openDisclaimer() {
  disclaimerOpen.value = true
}

function closeDisclaimer() {
  disclaimerOpen.value = false
  localStorage.setItem(DISCLAIMER_KEY, '1')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && disclaimerOpen.value) {
    closeDisclaimer()
  }
}

onMounted(() => {
  if (!localStorage.getItem(DISCLAIMER_KEY)) {
    disclaimerOpen.value = true
  }
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app">
    <header class="app__header">
      <p class="app__eyebrow">Agnes Image 2.1 Flash</p>
      <h1 class="app__title">无限想象</h1>
      <p class="app__desc">输入描述，通过 Agnes API 生成画面</p>
    </header>
    <main class="app__main">
      <ImageGenerator />
    </main>

    <footer class="app__footer">
      <p class="app__footer-text">
        请合法合规使用本工具，禁止用于违法违规及侵害他人权益的行为。
        <button type="button" class="app__footer-link" @click="openDisclaimer">
          查看完整用户须知与免责声明
        </button>
      </p>
    </footer>

    <DisclaimerModal :open="disclaimerOpen" @close="closeDisclaimer" />
  </div>
</template>

<style scoped>
.app {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.app__header {
  margin-bottom: 2rem;
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
  font-size: clamp(2.2rem, 5vw, 3rem);
  font-weight: 400;
  font-style: italic;
  line-height: 1.1;
  color: var(--text);
}

.app__desc {
  margin: 0.6rem 0 0;
  color: var(--text-muted);
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

@media (max-width: 839px) {
  .app {
    padding: 1.25rem 1rem 2.5rem;
  }

  .app__header {
    margin-bottom: 1.25rem;
  }

  .app__footer {
    margin-top: 1.5rem;
  }
}
</style>
