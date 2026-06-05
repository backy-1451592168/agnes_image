# Agnes 文生图（Vue 3 + TypeScript）

基于 [Agnes Image 2.1 Flash](https://agnes-ai.com/doc/agnes-image-21-flash) 的文生图小工具：输入提示词，调用 API 生成并预览图片。

## 前置条件

- Node.js 18+（推荐 20+）
- 在 [Agnes 平台 API Keys 页面](https://platform.agnes-ai.com/settings/apiKeys) 注册并创建 API Key（应用内也有「前往官网获取 Key」入口）

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址（默认 `http://localhost:5173`），填入 API Key 与提示词后点击「生成图片」。可上传**参考图**在底图上改图；生成后可继续输入「修改说明」逐轮改图。对话中的图片与参考图预览均可**点击放大**；点击「新对话」可清空记录与参考图。

### 环境变量

| 文件 | 说明 |
|------|------|
| `.env.development` | `npm run dev` 加载，`VITE_AGNES_API_BASE=/api`（Vite 代理） |
| `.env.production` | `npm run build` 加载，直连 `https://apihub.agnes-ai.com/v1` |

可在对应文件填入 `VITE_AGNES_API_KEY` 作为默认 Key（勿提交真实 Key 到 Git）。页面输入框中的 Key 优先于环境变量。

## API 说明

开发环境通过 Vite 代理转发，避免浏览器 CORS：

| 前端请求 | 实际转发 |
|---------|---------|
| `POST /api/images/generations` | `POST https://apihub.agnes-ai.com/v1/images/generations` |

请求体示例：

```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "你的描述",
  "size": "1024x768"
}
```

> 注意：该模型不支持 `response_format` 参数，请勿在请求体中传入。

官方文档：

- [API 总览](https://agnes-ai.com/doc/overview)
- [Agnes Image 2.1 Flash](https://agnes-ai.com/doc/agnes-image-21-flash)

## 生产部署

`npm run build` 产出在 `dist/`。生产环境默认**直连** `https://apihub.agnes-ai.com/v1/images/generations`，不再请求站点自身的 `/api/...`（避免静态托管对 POST 返回 405）。

若浏览器报 CORS 跨域：在 `.env.production` 改为 `VITE_AGNES_API_BASE=/api`，Nginx 配置下方反代后重新 `npm run build`。

Nginx 反代示例（仅在你选用方案 2 时需要）：

```nginx
location /api/ {
  proxy_pass https://apihub.agnes-ai.com/v1/;
  proxy_set_header Host apihub.agnes-ai.com;
  proxy_ssl_server_name on;
}
```

## 安全提示

- API Key 会出现在浏览器请求头中，仅适合个人本地或受控内网使用
- 不要将真实 Key 写入仓库或公开部署的前端

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（含 API 代理） |
| `npm run build` | 类型检查并构建 |
| `npm run preview` | 预览生产构建 |
