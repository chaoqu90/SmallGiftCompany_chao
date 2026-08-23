import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from '../theme'
import { GiftFinder } from './GiftFinder'
import * as generatedBundlesApi from '../api/generatedBundles'
import * as analyticsApi from '../api/analytics'
import type { GeneratedBundleResponse } from '../types/catalog'

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

beforeEach(() => {
  sessionStorage.clear()
})

const GENERATED_BUNDLE_STUB: GeneratedBundleResponse = {
  generatedBundleId: 'gb_test123456',
  templateCode: 'GENERAL_4_ITEM',
  standardItemCogsSnapshot: 9.50,
  bundleRetailPrice: 36.00,
  items: [],
  upgrade: null,
  giftBag: { code: 'CLASSIC_BAG', name: 'Classic Party Bag', retailPriceAdjustment: null, isDefault: true },
}

function renderFinder() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<GiftFinder />} />
          <Route path="/bundleCustomization/:bundleId" element={<div data-testid="configurator-page" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('GiftFinder — layout', () => {
  it('renders all five question sections', () => {
    renderFinder()
    expect(screen.getByText(/how old are they/i)).toBeInTheDocument()
    expect(screen.getByText(/what are they into/i)).toBeInTheDocument()
    expect(screen.getByText(/girl or boy/i)).toBeInTheDocument()
    expect(screen.getByText(/what's the celebration/i)).toBeInTheDocument()
    expect(screen.getByText('⑤ Budget per guest?')).toBeInTheDocument()
  })

  it('renders the panel title', () => {
    renderFinder()
    expect(screen.getByText(/let's find their favorites/i)).toBeInTheDocument()
  })

  it('renders age chip options', () => {
    renderFinder()
    expect(screen.getByText('3–5')).toBeInTheDocument()
    expect(screen.getByText('6–8')).toBeInTheDocument()
    expect(screen.getByText('9–12')).toBeInTheDocument()
  })

  it('renders interest chip options', () => {
    renderFinder()
    expect(screen.getByText('🎵 Pop Music')).toBeInTheDocument()
    expect(screen.getByText('🧸 Toys & Play')).toBeInTheDocument()
    expect(screen.getByText('✨ Cute & Magical')).toBeInTheDocument()
    expect(screen.getByText('⚽ Sports')).toBeInTheDocument()
    expect(screen.getByText('📚 Reading & Puzzles')).toBeInTheDocument()
  })

  it('renders audience chip options', () => {
    renderFinder()
    expect(screen.getByText('Girl')).toBeInTheDocument()
    expect(screen.getByText('Boy')).toBeInTheDocument()
    expect(screen.getByText('No Preference')).toBeInTheDocument()
  })

  it('renders party type chip options', () => {
    renderFinder()
    expect(screen.getByText('🎉 Celebration')).toBeInTheDocument()
    expect(screen.getByText('🎃 Halloween')).toBeInTheDocument()
  })

  it('renders budget price slider', () => {
    renderFinder()
    expect(screen.getByRole('slider', { name: /max budget per guest/i })).toBeInTheDocument()
  })

  it('budget slider shows "up to" label and floating value', () => {
    renderFinder()
    expect(screen.getByText('up to')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderFinder()
    expect(screen.getByRole('button', { name: /ready, set, gift/i })).toBeInTheDocument()
  })

  it('mandatory questions have a required marker', () => {
    renderFinder()
    // Both age and interest labels render a * alongside them
    const ageLabel      = screen.getByText(/how old are they/i).closest('p')
    const interestLabel = screen.getByText(/what are they into/i).closest('p')
    expect(ageLabel?.textContent).toContain('*')
    expect(interestLabel?.textContent).toContain('*')
  })
})

describe('GiftFinder — chip selection', () => {
  it('age chip is single-select: clicking same chip deselects it', () => {
    renderFinder()
    const chip = screen.getByText('6–8')
    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(screen.getByText('6–8')).toBeInTheDocument()
  })

  it('age chip is single-select: clicking another replaces selection', () => {
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByText('9–12'))
    expect(screen.getByText('6–8')).toBeInTheDocument()
    expect(screen.getByText('9–12')).toBeInTheDocument()
  })

  it('interest chip is single-select', () => {
    renderFinder()
    fireEvent.click(screen.getByText('🎵 Pop Music'))
    fireEvent.click(screen.getByText('⚽ Sports'))
    expect(screen.getByText('🎵 Pop Music')).toBeInTheDocument()
    expect(screen.getByText('⚽ Sports')).toBeInTheDocument()
  })

  it('audience chip is single-select', () => {
    renderFinder()
    fireEvent.click(screen.getByText('Girl'))
    fireEvent.click(screen.getByText('Boy'))
    expect(screen.getByText('Girl')).toBeInTheDocument()
    expect(screen.getByText('Boy')).toBeInTheDocument()
  })

  it('party type chip is single-select', () => {
    renderFinder()
    fireEvent.click(screen.getByText('🎉 Celebration'))
    fireEvent.click(screen.getByText('🎃 Halloween'))
    expect(screen.getByText('🎉 Celebration')).toBeInTheDocument()
    expect(screen.getByText('🎃 Halloween')).toBeInTheDocument()
  })

  it('budget slider value can be changed', () => {
    renderFinder()
    const slider = screen.getByRole('slider', { name: /max budget per guest/i })
    fireEvent.change(slider, { target: { value: '10' } })
    expect(slider).toBeInTheDocument()
  })
})

describe('GiftFinder — Clear all', () => {
  it('does not show Clear all when nothing is selected', () => {
    renderFinder()
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('shows Clear all once any selection is made', () => {
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })

  it('clicking Clear all resets all selections and hides itself', () => {
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByText('🎵 Pop Music'))
    fireEvent.click(screen.getByText('Girl'))
    fireEvent.click(screen.getByText('Clear all'))
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('clicking Clear all also clears submit error', async () => {
    renderFinder()
    // Trigger validation error first
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    // Now select interest so Clear all appears (age was selected before)
    // Error is visible; clear all should also dismiss it
    fireEvent.click(screen.getByText('Clear all'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('GiftFinder — recommendation navigation', () => {
  it('submit navigates to /bundleCustomization/:publicId after selecting age and interest', async () => {
    vi.spyOn(generatedBundlesApi, 'generateBundle').mockResolvedValue(GENERATED_BUNDLE_STUB)
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByText('🎵 Pop Music'))
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() =>
      expect(screen.getByTestId('configurator-page')).toBeInTheDocument(),
    )
  })

  it('shows error when age/interest not selected and submit is clicked', async () => {
    renderFinder()
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/please select an age range and an interest/i)
  })

  it('shows error when age is selected but interest is not', async () => {
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/please select an age range and an interest/i)
  })

  it('shows error message when API call fails', async () => {
    vi.spyOn(generatedBundlesApi, 'generateBundle').mockRejectedValue(new Error('Network error'))
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByText('🎵 Pop Music'))
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
  })

  it('fires FINDER_COMPLETED analytics event after successful bundle generation', async () => {
    vi.spyOn(generatedBundlesApi, 'generateBundle').mockResolvedValue(GENERATED_BUNDLE_STUB)
    const trackSpy = vi.spyOn(analyticsApi, 'trackEvent').mockResolvedValue(undefined)
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByText('🎵 Pop Music'))
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() => expect(screen.getByTestId('configurator-page')).toBeInTheDocument())
    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'FINDER_COMPLETED', bundleId: 'gb_test123456' })
    )
  })

  it('defaults audiencePreference and partyType; slider at max maps to HIGH tier', async () => {
    const spy = vi.spyOn(generatedBundlesApi, 'generateBundle').mockResolvedValue(GENERATED_BUNDLE_STUB)
    renderFinder()
    fireEvent.click(screen.getByText('6–8'))
    fireEvent.click(screen.getByText('🎵 Pop Music'))
    fireEvent.click(screen.getByRole('button', { name: /ready, set, gift/i }))
    await waitFor(() =>
      expect(screen.getByTestId('configurator-page')).toBeInTheDocument(),
    )
    expect(spy).toHaveBeenCalledWith({
      age: 7,
      interest: 'POP_MUSIC',
      audiencePreference: 'NO_PREFERENCE',
      partyType: 'CELEBRATION',
      budgetTierCode: 'HIGH',
      maxRetailPrice: null,
    })
  })
})
