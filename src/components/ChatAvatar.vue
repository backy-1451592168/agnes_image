<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant'
}>()
</script>

<template>
  <div
    class="avatar"
    :class="`avatar--${role}`"
    aria-hidden="true"
  >
    <!-- 用户 -->
    <svg
      v-if="role === 'user'"
      class="avatar__svg"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="11" class="avatar__bg" />
      <circle cx="12" cy="9" r="3.2" fill="currentColor" />
      <path
        d="M6.5 18.5c.8-2.8 3-4.5 5.5-4.5s4.7 1.7 5.5 4.5"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>

    <!-- AI -->
    <svg
      v-else
      class="avatar__svg"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="11" class="avatar__bg" />
      <path
        d="M12 6.5l1.1 2.6 2.8.4-2 2 0.5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4L12 6.5z"
        fill="currentColor"
      />
      <rect
        x="7"
        y="14.5"
        width="10"
        height="3.5"
        rx="1"
        stroke="currentColor"
        stroke-width="1.4"
      />
      <path
        d="M9.5 16h5"
        stroke="currentColor"
        stroke-width="1"
        stroke-linecap="round"
        opacity="0.6"
      />
    </svg>
  </div>
</template>

<style scoped>
.avatar {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
}

.avatar__svg {
  width: 100%;
  height: 100%;
  display: block;
}

.avatar--user {
  color: var(--text);
}

.avatar--user .avatar__bg {
  fill: var(--surface-raised);
  stroke: var(--border);
  stroke-width: 1;
}

.avatar--assistant {
  color: var(--accent);
}

.avatar--assistant .avatar__bg {
  fill: rgba(212, 168, 120, 0.15);
  stroke: var(--accent-dim);
  stroke-width: 1;
}
</style>
