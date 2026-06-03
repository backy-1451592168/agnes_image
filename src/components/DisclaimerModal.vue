<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="disclaimer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div class="disclaimer__panel">
        <header class="disclaimer__head">
          <h2 id="disclaimer-title" class="disclaimer__title">用户须知与免责声明</h2>
          <button type="button" class="disclaimer__close" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="disclaimer__body">
          <p class="disclaimer__lead">
            使用本工具即表示您已阅读、理解并同意以下内容。若不同意，请立即停止使用。
          </p>

          <section>
            <h3>一、合法合规使用</h3>
            <ul>
              <li>本工具仅供个人学习、研究及合法创作用途，不得用于任何违法或不当目的。</li>
              <li>您应遵守中华人民共和国法律法规及您所在国家/地区的全部适用法律。</li>
              <li>不得利用本工具从事诈骗、赌博、传销、洗钱、窃取商业秘密等违法犯罪活动。</li>
            </ul>
          </section>

          <section>
            <h3>二、禁止生成的内容</h3>
            <p>您不得通过本工具生成、传播、下载或利用包括但不限于以下内容：</p>
            <ul>
              <li>淫秽色情、性剥削，或对未成年人有害的内容；</li>
              <li>暴力恐怖、极端主义、煽动仇恨或歧视的言论与图像；</li>
              <li>侵犯他人肖像权、隐私权、名誉权的内容；</li>
              <li>未经授权的他人肖像深度伪造（Deepfake）、换脸及误导性仿冒；</li>
              <li>侵犯著作权、商标权、专利权的盗版或抄袭作品；</li>
              <li>虚假新闻、造谣诽谤、伪造证件/票据/公章等可用于欺诈的材料；</li>
              <li>危害国家安全、泄露国家秘密、颠覆国家政权的内容；</li>
              <li>毒品、武器、爆炸物等违禁品的制作教程或交易信息；</li>
              <li>其他违反公序良俗或可能被用于伤害他人、社会的内容。</li>
            </ul>
          </section>

          <section>
            <h3>三、用户责任</h3>
            <ul>
              <li>您对输入的提示词、上传的参考图及生成结果承担全部法律责任。</li>
              <li>因您的使用行为导致的一切纠纷、索赔、行政处罚，由您自行承担，与本工具作者无关。</li>
              <li>您应自行判断生成内容是否适合公开传播，并履行必要的标识义务（如适用）。</li>
            </ul>
          </section>

          <section>
            <h3>四、API 与数据安全</h3>
            <ul>
              <li>本工具通过第三方 <a href="https://agnes-ai.com/" target="_blank" rel="noopener noreferrer">Agnes AI</a> 接口提供服务，您须遵守其平台规则与配额限制。</li>
              <li>API Key 由您自行保管，请勿泄露或提交至公开仓库；Key 泄露所致损失由您自行承担。</li>
              <li>参考图、对话记录等可能保存在您本机浏览器（如 localStorage），请勿在公共设备上保存敏感信息。</li>
            </ul>
          </section>

          <section>
            <h3>五、免责与无担保</h3>
            <ul>
              <li>本工具按「现状」提供，不对生成结果的准确性、合法性、完整性作任何担保。</li>
              <li>服务可能因网络、第三方 API 故障、排队、审核等原因中断或失败，我们不保证持续可用。</li>
              <li>对于因使用或无法使用本工具而产生的直接或间接损失，在法律允许的最大范围内我们不承担责任。</li>
            </ul>
          </section>

          <section>
            <h3>六、其他</h3>
            <ul>
              <li>我们反对一切滥用 AI 生成技术伤害他人、侵害权益或规避监管的行为。</li>
              <li>如发现违法违规使用线索，您应向有关主管部门举报，而非利用本工具继续违规。</li>
              <li>本声明内容可随法律法规或产品调整而更新，继续使用视为接受更新后的条款。</li>
            </ul>
          </section>

          <p class="disclaimer__foot">最后更新：2026 年 6 月</p>
        </div>

        <footer class="disclaimer__actions">
          <button type="button" class="disclaimer__ok" @click="emit('close')">我已阅读并知悉</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.disclaimer {
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

.disclaimer__panel {
  width: min(100%, 560px);
  max-height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.disclaimer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.disclaimer__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 400;
  font-style: italic;
  line-height: 1.25;
}

.disclaimer__close {
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

.disclaimer__close:hover {
  color: var(--text);
  border-color: var(--accent-dim);
}

.disclaimer__body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--text-muted);
}

.disclaimer__lead {
  margin: 0 0 1rem;
  color: var(--text);
}

.disclaimer__body section {
  margin-bottom: 1rem;
}

.disclaimer__body h3 {
  margin: 0 0 0.4rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
}

.disclaimer__body ul {
  margin: 0.35rem 0 0;
  padding-left: 1.15rem;
}

.disclaimer__body li {
  margin-bottom: 0.35rem;
}

.disclaimer__body a {
  color: var(--accent);
}

.disclaimer__foot {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  opacity: 0.75;
}

.disclaimer__actions {
  padding: 0.85rem 1.25rem 1.1rem;
  border-top: 1px solid var(--border);
}

.disclaimer__ok {
  width: 100%;
  padding: 0.7rem 1rem;
  font-weight: 600;
  color: var(--bg);
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  border: none;
  border-radius: 6px;
}

.disclaimer__ok:hover {
  filter: brightness(1.06);
}
</style>
