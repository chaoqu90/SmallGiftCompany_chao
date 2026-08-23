const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function adminRequest<T>(path: string, authHeader: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Authorization': authHeader,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    ...init,
  })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface AdminProduct {
  id:                number
  sku:               string
  name:              string
  active:            boolean
  inventoryQuantity: number
  cost:              number
  cogAdjusted:       number
  retailPrice:       number
  upgradeTier:       string
  category:          string
  formFactor:        string
  minAge:            number
  maxAge:            number
}

export interface ProductMeta {
  categories:   string[]
  upgradeTiers: string[]
  formFactors:  string[]
}

export interface CreateProductRequest {
  sku:          string
  name:         string
  description:  string
  cost:         number
  cogOverhead:  number
  category:     string
  upgradeTier:  string
  formFactor:   string
  minAge:       number
  maxAge:       number
}

export interface AdminBundleListItem {
  id: number
  publicId: string
  requestedAge: number
  audiencePreference: string
  interest: string
  partyType: string
  templateCode: string
  baseRetailPrice: number | null
  status: string
  createdAt: string
}

export interface AdminBundleDetail extends AdminBundleListItem {
  items: {
    slotCode: string
    productName: string
    sku: string
    formFactor: string
  }[]
}

export interface AdminDashboard {
  finderCompletions: number
  bundleViews: number
}

export interface ProductCoverage {
  productId: number
  name: string
  appearanceCount: number
  totalCombinations: number
  agesCovered: string[]
  audiencesCovered: string[]
  partyTypesCovered: string[]
  interestsCovered: string[]
  budgetsCovered: string[]
}

export interface ProductAffinities {
  interestWeights: Record<string, number>
  audienceWeights: Record<string, number>
  roleWeights:     Record<string, number>
  occasions:       string[]
}

export const adminApi = {
  getProducts: (auth: string) =>
    adminRequest<AdminProduct[]>('/admin/api/products/', auth),

  updateInventory: (auth: string, id: number, quantity: number) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/inventory`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),

  setActive: (auth: string, id: number, active: boolean) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/active`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  getBundles: (auth: string) =>
    adminRequest<AdminBundleListItem[]>('/admin/api/bundles/', auth),

  getBundleDetail: (auth: string, publicId: string) =>
    adminRequest<AdminBundleDetail>(`/admin/api/bundles/${publicId}`, auth),

  getDashboard: (auth: string) =>
    adminRequest<AdminDashboard>('/admin/api/dashboard/', auth),

  getProductCoverage: (auth: string) =>
    adminRequest<ProductCoverage[]>('/admin/api/dashboard/product-coverage', auth),

  getAffinities: (auth: string, id: number) =>
    adminRequest<ProductAffinities>(`/admin/api/products/${id}/affinities`, auth),

  updateAffinities: (auth: string, id: number, data: ProductAffinities) =>
    adminRequest<ProductAffinities>(`/admin/api/products/${id}/affinities`, auth, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getMeta: (auth: string) =>
    adminRequest<ProductMeta>('/admin/api/products/meta', auth),

  updatePricing: (auth: string, id: number, cost: number, cogOverhead: number) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/pricing`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ cost, cogOverhead }),
    }),

  updateCategory: (auth: string, id: number, category: string) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/category`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    }),

  updateUpgradeTier: (auth: string, id: number, upgradeTier: string) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/upgrade-tier`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ upgradeTier }),
    }),

  deleteProduct: (auth: string, id: number) =>
    adminRequest<void>(`/admin/api/products/${id}`, auth, { method: 'DELETE' }),

  createProduct: (auth: string, data: CreateProductRequest) =>
    adminRequest<AdminProduct>('/admin/api/products/', auth, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAgeRange: (auth: string, id: number, minAge: number, maxAge: number) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/age-range`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ minAge, maxAge }),
    }),

  updateDetails: (auth: string, id: number, name: string, category: string, formFactor: string) =>
    adminRequest<AdminProduct>(`/admin/api/products/${id}/details`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ name, category, formFactor }),
    }),
}
