export const AGNES_IMAGE_MODEL = 'agnes-image-2.1-flash' as const

export type ImageSize = '1024x768' | '1024x1024' | '1024x1536'

export interface GenerateImageParams {
  prompt: string
  size: ImageSize
  apiKey: string
  /** 上一轮生成图，用于连续修改（图生图） */
  referenceImage?: string
}

export interface ImageGenerationRequest {
  model: typeof AGNES_IMAGE_MODEL
  prompt: string
  size: ImageSize
  extra_body?: {
    image: string[]
  }
}

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  prompt?: string
  /** 本轮使用的上传参考图（仅展示） */
  referenceImageSrc?: string
  imageSrc?: string
  error?: string
  pending?: boolean
}

export interface GeneratedImageItem {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageGenerationResponse {
  created?: number
  data: GeneratedImageItem[]
}

export interface ApiErrorBody {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}
