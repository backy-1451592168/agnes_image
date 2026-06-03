<script setup lang="ts">
import ImageGenerator from './components/ImageGenerator.vue'
</script>

<template>
  <div class="app">
    <header class="app__header">
      <p class="app__eyebrow">Agnes Image 2.1 Flash</p>
      <h1 class="app__title">文生图</h1>
      <p class="app__desc">输入描述，通过 Agnes API 生成画面</p>
    </header>
    <main class="app__main">
      <ImageGenerator />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 1100px;
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
</style>
