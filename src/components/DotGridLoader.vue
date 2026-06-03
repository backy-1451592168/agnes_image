<template>
  <div class="dot-loader" role="status" aria-label="图片生成中">
    <div class="dot-loader__surface" :style="{ aspectRatio }" aria-hidden="true">
      <div class="dot-loader__dots" />
    </div>
    <p v-if="label" class="dot-loader__label">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    aspectRatio?: string
  }>(),
  {
    label: '生成中…',
    aspectRatio: '1024 / 768',
  },
)
</script>

<style scoped>
.dot-loader {
  width: 100%;
}

.dot-loader__surface {
  position: relative;
  width: 100%;
  min-height: 240px;
  border-radius: 6px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: #d6d2cd;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

/* 点阵固定不动，仅径向遮罩缩放形成中心↔四周闪烁 */
.dot-loader__dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(58, 54, 50, 0.58) 2px, transparent 2px);
  background-size: 20px 20px;
  background-position: center;
  -webkit-mask-image: radial-gradient(
    circle at 50% 50%,
    #000 0%,
    #000 38%,
    transparent 72%
  );
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, #000 38%, transparent 72%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  animation: dot-radial-flash 2.8s ease-in-out infinite;
}

/* 中心→四周渐显，再切换为四周→中心渐显 */
@keyframes dot-radial-flash {
  0% {
    -webkit-mask-image: radial-gradient(
      circle at 50% 50%,
      #000 0%,
      #000 36%,
      transparent 70%
    );
    mask-image: radial-gradient(circle at 50% 50%, #000 0%, #000 36%, transparent 70%);
    -webkit-mask-size: 8% 8%;
    mask-size: 8% 8%;
  }
  48% {
    -webkit-mask-size: 230% 230%;
    mask-size: 230% 230%;
  }
  50% {
    -webkit-mask-image: radial-gradient(
      circle at 50% 50%,
      transparent 0%,
      transparent 42%,
      #000 58%,
      #000 100%
    );
    mask-image: radial-gradient(
      circle at 50% 50%,
      transparent 0%,
      transparent 42%,
      #000 58%,
      #000 100%
    );
    -webkit-mask-size: 230% 230%;
    mask-size: 230% 230%;
  }
  100% {
    -webkit-mask-size: 8% 8%;
    mask-size: 8% 8%;
  }
}

.dot-loader__label {
  margin: 0.55rem 0 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}
</style>
