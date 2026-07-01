import {
  type ApiErrorBody,
  type GenerateImageParams,
  type ImageGenerationRequest,
  type ImageGenerationResponse,
  type GeneratedImageItem,
  type ModelsListResponse,
} from '../types/agnes'

const envApiBase = import.meta.env.VITE_AGNES_API_BASE.replace(/\/$/, '')

export function normalizeApiBase(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '')
  if (!trimmed) return envApiBase
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

export function defaultBaseUrlDisplay(): string {
  return envApiBase.replace(/\/v1$/, '')
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody & { message?: string }
    if (body.error?.message) return body.error.message
    if (typeof body.message === 'string') return body.message
  } catch {
    /* ignore */
  }
  return `请求失败 (${res.status})`
}

export function imageItemToSrc(item: GeneratedImageItem): string | null {
  if (item.url) return item.url
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
  return null
}

export async function fetchAvailableModels(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  const apiBase = normalizeApiBase(baseUrl)
  const key = apiKey.trim()
  if (!key) throw new Error('请填写 API Key')

  const res = await fetch(`${apiBase}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }

  const data = (await res.json()) as ModelsListResponse
  const ids = (data.data ?? []).map((m) => m.id).filter(Boolean)
  if (!ids.length) throw new Error('未找到可用模型')
  return ids.sort()
}

export async function generateImage(
  params: GenerateImageParams,
): Promise<ImageGenerationResponse> {
  const apiBase = normalizeApiBase(params.baseUrl)
  const endpoint = `${apiBase}/images/generations`

  const body: ImageGenerationRequest = {
    model: params.model,
    prompt: params.prompt.trim(),
    size: params.size,
  }

  if (params.referenceImage) {
    body.extra_body = { image: [params.referenceImage] }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }

  const data = (await res.json()) as ImageGenerationResponse
  if (!data.data?.length) {
    throw new Error('API 未返回图片数据')
  }

  return data
}
