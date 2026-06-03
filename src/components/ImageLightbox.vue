<script setup lang="ts">
defineProps<{ src: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="lightbox" role="dialog" aria-modal="true" @click.self="emit('close')">
    <button type="button" class="lightbox__close" aria-label="关闭" @click="emit('close')">
      ×
    </button>
    <img :src="src" alt="放大预览" class="lightbox__img" @click.stop />
  </div>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(8, 7, 6, 0.88);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
}

.lightbox__img {
  max-width: min(96vw, 1400px);
  max-height: 92vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  cursor: default;
}

.lightbox__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
  transition: border-color 0.15s;
}

.lightbox__close:hover {
  border-color: var(--accent);
}
</style>
