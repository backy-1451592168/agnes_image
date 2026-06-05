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

  .app__footer {
    margin-top: 1.5rem;
  }
}
</style>
