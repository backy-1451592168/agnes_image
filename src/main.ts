import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

if (import.meta.env.DEV) {
  void import('vconsole').then(({ default: VConsole }) => {
    new VConsole()
  })
}

createApp(App).mount('#app')
