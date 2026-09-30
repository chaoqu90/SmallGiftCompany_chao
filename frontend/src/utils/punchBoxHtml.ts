/**
 * Punch Box HTML Preview — client-side generation utility.
 *
 * Customer-facing receipt: shows size, products, quantities, retail price.
 * No internal cost or profit figures are included.
 * Appendix page shows product name + image pairs.
 *
 * Requirements: R_HTML (ACHTML.1–ACHTML.5)
 * Design: specs/punch-box/design.md §9
 */

export interface PunchBoxHtmlData {
  publicId:    string | null   // null for unsaved drafts
  slotCount:   number | null
  retailPrice: number
  items: {
    productName: string
    quantity:    number
    imageUrl?:   string | null
  }[]
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * Generates a complete, self-contained HTML string for a punch box summary.
 * No external dependencies — all styles are inline.
 * Includes a print-page-break appendix with product images.
 */
export function generatePunchBoxHtml(data: PunchBoxHtmlData): string {
  const idLabel      = data.publicId ?? 'Draft'
  const sizeLabel    = data.slotCount != null ? `${data.slotCount} slots` : '—'
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const itemRows = data.items.map((item, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(item.productName)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
    </tr>`).join('')

  // Appendix cards — only items that have an image
  const appendixItems = data.items.filter(i => i.imageUrl)
  const appendixCards = appendixItems.map(item => `
    <div style="display:inline-block;vertical-align:top;width:180px;margin:12px;
                text-align:center;border:1px solid #eee;border-radius:8px;
                padding:12px;box-sizing:border-box;">
      <img src="${escapeHtml(item.imageUrl!)}"
           alt="${escapeHtml(item.productName)}"
           style="width:140px;height:140px;object-fit:cover;border-radius:6px;display:block;margin:0 auto 8px;" />
      <div style="font-size:0.8rem;color:#333;font-weight:600;line-height:1.3;">
        ${escapeHtml(item.productName)}
      </div>
      <div style="font-size:0.75rem;color:#888;margin-top:4px;">qty: ${item.quantity}</div>
    </div>`).join('')

  const appendixSection = appendixItems.length > 0 ? `
  <div style="page-break-before:always;padding-top:32px;">
    <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:4px;color:#1D1D1F;">
      Product Reference
    </h2>
    <p style="font-size:0.85rem;color:#666;margin-bottom:20px;">
      Visual guide to each item included in your punch box.
    </p>
    <div style="font-size:0;">
      ${appendixCards}
    </div>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Punch Box — ${escapeHtml(idLabel)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1D1D1F;
      max-width: 720px;
      margin: 40px auto;
      padding: 0 24px;
      line-height: 1.5;
    }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 2px; color: #F47F6B; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead tr { background: #F5F5F5; }
    th { padding: 10px 12px; text-align: left; font-size: 0.8rem;
         text-transform: uppercase; letter-spacing: 0.05em;
         border-bottom: 2px solid #ddd; }
    .total-row { background: #FFF8F6; }
    .total-row td { padding: 10px 12px; font-weight: 700; font-size: 1rem; }
    footer { font-size: 0.78rem; color: #999; margin-top: 32px;
             border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { margin: 20px auto; }
    }
  </style>
</head>
<body>
  <h1>It Is A Small Gift Co.</h1>
  <div style="font-size:1.1rem;font-weight:600;margin-bottom:4px;">Punch Box Summary</div>
  <div class="meta">
    <span>Ref: <strong>${escapeHtml(idLabel)}</strong></span>
    &nbsp;&bull;&nbsp;
    <span>Size: <strong>${escapeHtml(sizeLabel)}</strong></span>
    &nbsp;&bull;&nbsp;
    <span>Date: <strong>${escapeHtml(generatedDate)}</strong></span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th>Product</th>
        <th style="text-align:center;width:80px;">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="3" style="padding:12px;color:#888;">No products selected.</td></tr>'}
    </tbody>
  </table>

  <table style="max-width:320px;">
    <tbody>
      <tr class="total-row">
        <td>Total Price</td>
        <td style="text-align:right;">${escapeHtml(fmt.format(data.retailPrice))}</td>
      </tr>
    </tbody>
  </table>

  <footer>
    It Is A Small Gift Co. &mdash; Good Stuff. Handpicked By Kids.<br>
    Punch Box Ref: ${escapeHtml(idLabel)} &bull; Generated: ${escapeHtml(generatedDate)}
  </footer>

  ${appendixSection}
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
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `punch-box-${data.publicId ?? 'draft'}.html`
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
