import {
  AGNES_IMAGE_MODEL,
  type ApiErrorBody,
  type GenerateImageParams,
  type ImageGenerationRequest,
  type ImageGenerationResponse,
  type GeneratedImageItem,
} from '../types/agnes'

const apiBase = import.meta.env.VITE_AGNES_API_BASE.replace(/\/$/, '')
const ENDPOINT = `${apiBase}/images/generations`

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

export async function generateImage(
  params: GenerateImageParams,
): Promise<ImageGenerationResponse> {
  const body: ImageGenerationRequest = {
    model: AGNES_IMAGE_MODEL,
    prompt: params.prompt.trim(),
    size: params.size,
  }

  if (params.referenceImage) {
    body.extra_body = { image: [params.referenceImage] }
  }

  const res = await fetch(ENDPOINT, {
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
