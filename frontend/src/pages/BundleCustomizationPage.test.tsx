import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { describe, it, expect, vi, afterEach } from 'vitest'
import theme from '../theme'
import { BundleCustomizationPage } from './BundleCustomizationPage'
import * as generatedBundlesApi from '../api/generatedBundles'
import type { GeneratedBundleResponse } from '../types/catalog'

afterEach(() => vi.restoreAllMocks())

// ── Test fixtures ────────────────────────────────────────────────────────────

const GENERATED_BUNDLE_RESPONSE: GeneratedBundleResponse = {
  generatedBundleId: 'gb_test123456',
  templateCode: 'GENERAL_4_ITEM',
  standardItemCogsSnapshot: 9.50,
  bundleRetailPrice: 36.00,
  items: [
    { slotCode: 'UTILITY',  productName: 'Mini Crayon Set',      sku: 'CRAYON-001',  description: '8-colour mini crayon set',       formFactor: 'LINEAR', quantityPerBag: 1, displayOrder: 1 },
    { slotCode: 'ACTIVITY', productName: 'Unicorn Sticker Pack', sku: 'STICKER-001', description: 'Pack of 12 unicorn stickers',     formFactor: 'FLAT',   quantityPerBag: 1, displayOrder: 2 },
    { slotCode: 'PLAY',     productName: 'Rainbow Silly Putty',  sku: 'PUTTY-001',   description: 'Stretchy rainbow-coloured putty', formFactor: 'ROUND',  quantityPerBag: 1, displayOrder: 3 },
  ],
  upgrade: {
    standardProductName: 'Rainbow Silly Putty',
    standardSku: 'PUTTY-001',
    standardRetailAdjustment: null,
    upgradedProductName: 'Premium Art Set',
    upgradedSku: 'ART-PREMIUM-001',
    upgradedRetailAdjustment: 9.00,
  },
  giftBag: {
    code: 'CLASSIC_BAG',
    name: 'Classic Party Bag',
    retailPriceAdjustment: null,
    isDefault: true,
  },
}

function renderPage(bundleId = 'gb_test123456') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/bundleCustomization/${bundleId}`]}>
        <Routes>
          <Route path="/bundleCustomization/:bundleId" element={<BundleCustomizationPage />} />
          <Route path="/" element={<div data-testid="home-page" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

// ── Routing / loading ────────────────────────────────────────────────────────

describe('BundleCustomizationPage — routing and data loading', () => {
  it('shows loading state while fetching', () => {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByTestId('configurator-loading')).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockRejectedValue({ message: 'Not found' })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('configurator-error')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Not found')
  })

  it('renders bundle name after successful fetch', async () => {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  })
})

// ── Included items section ───────────────────────────────────────────────────

describe('BundleCustomizationPage — Included items', () => {
  async function setup() {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  }

  it('renders all item cards', async () => {
    await setup()
    expect(screen.getByText('Mini Crayon Set')).toBeInTheDocument()
    expect(screen.getByText('Unicorn Sticker Pack')).toBeInTheDocument()
    // 'Rainbow Silly Putty' also appears as the standard upgrade label
    expect(screen.getAllByText('Rainbow Silly Putty').length).toBeGreaterThanOrEqual(1)
  })

  it('item cards are rendered with button semantics', async () => {
    await setup()
    const buttons = screen.getAllByRole('button', { hidden: false })
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })

  it('clicking an item card sets it as highlighted (aria-pressed=true)', async () => {
    await setup()
    const cards = screen.getAllByRole('button')
    const itemCard = cards.find((b) => b.textContent?.includes('Mini Crayon Set'))
    expect(itemCard).toBeDefined()
    fireEvent.click(itemCard!)
    expect(itemCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking a highlighted card deselects it (toggle)', async () => {
    await setup()
    const cards = screen.getAllByRole('button')
    const itemCard = cards.find((b) => b.textContent?.includes('Mini Crayon Set'))!
    fireEvent.click(itemCard)
    expect(itemCard).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(itemCard)
    expect(itemCard).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a different card moves highlight away from first card', async () => {
    await setup()
    const cards = screen.getAllByRole('button')
    const crayon   = cards.find((b) => b.textContent?.includes('Mini Crayon Set'))!
    const stickers = cards.find((b) => b.textContent?.includes('Unicorn Sticker Pack'))!
    fireEvent.click(crayon)
    expect(crayon).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(stickers)
    expect(stickers).toHaveAttribute('aria-pressed', 'true')
    expect(crayon).toHaveAttribute('aria-pressed', 'false')
  })
})

// ── Upgrade section — mutual exclusion ──────────────────────────────────────

describe('BundleCustomizationPage — Upgrade section mutual exclusion', () => {
  async function setup() {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  }

  it('renders exactly 2 upgrade options', async () => {
    await setup()
    const upgradeGroup = screen.getByTestId('upgrade-group')
    const radios = upgradeGroup.querySelectorAll('[role="radio"]')
    expect(radios).toHaveLength(2)
  })

  it('Standard is selected by default', async () => {
    await setup()
    const upgradeGroup = screen.getByTestId('upgrade-group')
    const [standard] = upgradeGroup.querySelectorAll('[role="radio"]')
    expect(standard).toHaveAttribute('aria-checked', 'true')
  })

  it('selecting Upgraded deselects Standard', async () => {
    await setup()
    const upgradeGroup = screen.getByTestId('upgrade-group')
    const [standard, upgraded] = upgradeGroup.querySelectorAll('[role="radio"]')
    fireEvent.click(upgraded)
    expect(upgraded).toHaveAttribute('aria-checked', 'true')
    expect(standard).toHaveAttribute('aria-checked', 'false')
  })

  it('selecting Standard again deselects Upgraded', async () => {
    await setup()
    const upgradeGroup = screen.getByTestId('upgrade-group')
    const [standard, upgraded] = upgradeGroup.querySelectorAll('[role="radio"]')
    fireEvent.click(upgraded)
    fireEvent.click(standard)
    expect(standard).toHaveAttribute('aria-checked', 'true')
    expect(upgraded).toHaveAttribute('aria-checked', 'false')
  })
})

// ── Gift Bag section ─────────────────────────────────────────────────────────

describe('BundleCustomizationPage — Gift Bag section', () => {
  async function setup() {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  }

  it('renders the Gift Bag section', async () => {
    await setup()
    expect(screen.getByText('Gift Bag')).toBeInTheDocument()
  })

  it('renders Classic Party Bag option', async () => {
    await setup()
    expect(screen.getByText('Classic Party Bag')).toBeInTheDocument()
  })

  it('Classic Party Bag is selected by default', async () => {
    await setup()
    const giftBagGroup = screen.getByTestId('giftbag-group')
    const [classic] = giftBagGroup.querySelectorAll('[role="radio"]')
    expect(classic).toHaveAttribute('aria-checked', 'true')
  })

  it('gift bag option group uses radiogroup role', async () => {
    await setup()
    expect(screen.getByRole('radiogroup', { name: /gift bag options/i })).toBeInTheDocument()
  })
})

// ── Sticky top bar ───────────────────────────────────────────────────────────

describe('BundleCustomizationPage — sticky top bar', () => {
  async function setup() {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  }

  it('renders One bag per guest label', async () => {
    await setup()
    expect(screen.getByText(/one bag per guest/i)).toBeInTheDocument()
  })

  it('renders Back button in the top bar', async () => {
    await setup()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })
})

// ── Quantity & pricing ────────────────────────────────────────────────────────

describe('BundleCustomizationPage — quantity and pricing', () => {
  async function setup() {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  }

  it('renders the Party Size label', async () => {
    await setup()
    expect(screen.getByText(/party size/i)).toBeInTheDocument()
  })

  it('renders shipping info', async () => {
    await setup()
    expect(screen.getByText(/shipping/i)).toBeInTheDocument()
  })
})

// ── Continue CTA ─────────────────────────────────────────────────────────────

describe('BundleCustomizationPage — Continue button', () => {
  async function setup() {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockResolvedValue(GENERATED_BUNDLE_RESPONSE)
    renderPage()
    await waitFor(() => expect(screen.getByText('Your Custom Bundle')).toBeInTheDocument())
  }

  it('renders the Continue button', async () => {
    await setup()
    expect(screen.getByTestId('continue-btn')).toBeInTheDocument()
  })

  it('clicking Continue shows confirmation and hides the button', async () => {
    await setup()
    fireEvent.click(screen.getByTestId('continue-btn'))
    expect(screen.getByTestId('continue-confirmation')).toBeInTheDocument()
    expect(screen.queryByTestId('continue-btn')).not.toBeInTheDocument()
  })

  it('confirmation shows saved message', async () => {
    await setup()
    fireEvent.click(screen.getByTestId('continue-btn'))
    expect(screen.getByTestId('continue-confirmation')).toHaveTextContent(/your selection is saved/i)
  })
})
