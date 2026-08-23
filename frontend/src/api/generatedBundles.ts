import { api } from './client'
import type { BundleGenerationRequest, GeneratedBundleResponse } from '../types/catalog'

export function generateBundle(request: BundleGenerationRequest): Promise<GeneratedBundleResponse> {
  return api.post<GeneratedBundleResponse>('/api/generated-bundles', request)
}

export function getGeneratedBundle(publicId: string): Promise<GeneratedBundleResponse> {
  return api.get<GeneratedBundleResponse>(`/api/generated-bundles/${publicId}`)
}
