/**
 * Punch Box HTML Preview — client-side generation utility.
 *
 * Both functions are pure (no HTTP calls). The generated HTML is a
 * complete, self-contained document with inline CSS.
 *
 * Requirements: R_HTML (ACHTML.1–ACHTML.5)
 * Design: specs/punch-box/design.md §9
 */

export interface PunchBoxHtmlData {
  publicId:     string | null   // null for unsaved drafts
  slotCount:    number | null
  items: { productName: string; quantity: number }[]
  totalCogsUsd: number
  profitUsd:    number
  retailPrice:  number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * Generates a complete, self-contained HTML string for a punch box summary.
 * No external dependencies — all styles are inline.
 */
export function generatePunchBoxHtml(data: PunchBoxHtmlData): string {
  const idLabel = data.publicId ?? 'Draft'
  const sizeLabel = data.slotCount != null ? `${data.slotCount} slots` : '—'
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const itemRows = data.items.map(item => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapeHtml(item.productName)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Punch Box Summary — ${idLabel}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1D1D1F;
      max-width: 680px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.5;
    }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #F5F5F5; }
    th { padding: 10px 12px; text-align: left; font-size: 0.85rem; text-transform: uppercase;
         letter-spacing: 0.05em; border-bottom: 2px solid #ddd; }
    .pricing { background: #F9F9F9; border: 1px solid #E0E0E0; border-radius: 8px;
               padding: 16px 20px; margin-bottom: 24px; }
    .pricing-row { display: flex; justify-content: space-between; padding: 6px 0;
                   border-bottom: 1px solid #eee; }
    .pricing-row:last-child { border-bottom: none; font-weight: 700; font-size: 1.05rem; }
    .pricing-label { color: #555; }
    footer { font-size: 0.8rem; color: #888; margin-top: 32px; border-top: 1px solid #eee;
             padding-top: 12px; }
  </style>
</head>
<body>
  <h1>It Is A Small Gift Co. &mdash; Punch Box Summary</h1>
  <div class="meta">
    <span>ID: <strong>${escapeHtml(idLabel)}</strong></span>
    &nbsp;&bull;&nbsp;
    <span>Size: <strong>${escapeHtml(sizeLabel)}</strong></span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align: center;">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="2" style="padding:12px;color:#888;">No products selected.</td></tr>'}
    </tbody>
  </table>

  <div class="pricing">
    <div class="pricing-row">
      <span class="pricing-label">Total COGS</span>
      <span>${escapeHtml(fmt.format(data.totalCogsUsd))}</span>
    </div>
    <div class="pricing-row">
      <span class="pricing-label">Profit</span>
      <span>${escapeHtml(fmt.format(data.profitUsd))}</span>
    </div>
    <div class="pricing-row">
      <span class="pricing-label">Retail Price</span>
      <span>${escapeHtml(fmt.format(data.retailPrice))}</span>
    </div>
  </div>

  <footer>
    Punch Box ID: ${escapeHtml(idLabel)} &bull; Generated: ${escapeHtml(generatedDate)}
  </footer>
</body>
</html>`
}

/**
 * Generates the HTML preview and triggers a browser file download.
 * No HTTP calls — everything happens in the browser.
 */
export function downloadPunchBoxHtml(data: PunchBoxHtmlData): void {
  const html = generatePunchBoxHtml(data)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'punch-box-preview.html'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
