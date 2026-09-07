/**
 * Email helper — AWS SES.
 *
 * Sends an order confirmation email after a successful Stripe payment.
 * Uses the Lambda execution role's IAM permissions (no API key required).
 * AWS_REGION must be set (or defaulted via the Lambda environment).
 *
 * Fails silently with a console warning when running locally without
 * AWS credentials configured — allows local dev without email setup.
 *
 * Design: specs/payment/design.md §6
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Initialise once outside the handler for Lambda warm-reuse.
// Region defaults to the Lambda environment variable AWS_REGION.
const sesClient = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

export interface OrderEmailData {
  publicId: string;
  customerEmail: string;
  customerName: string | null;
  shippingStreet: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
  subtotal: number;
  total: number;
  lineItems: Array<{
    interest: string;
    upgradeTier: string;
    giftBagName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

function buildHtml(order: OrderEmailData): string {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  const itemRows = order.lineItems
    .map(li => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          ${li.interest.replace(/_/g, ' ')} Bundle (${li.upgradeTier})
          ${li.giftBagName ? `<br><small>Gift bag: ${li.giftBagName}</small>` : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${li.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt.format(li.unitPrice)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt.format(li.lineTotal)}</td>
      </tr>
    `)
    .join('');

  const shippingLines = [
    order.shippingStreet,
    [order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(', '),
    order.shippingCountry,
  ].filter(Boolean).join('<br>');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <h2 style="color:#1976d2;">Order Confirmed!</h2>
      <p>Thank you${order.customerName ? `, ${order.customerName}` : ''}! Your Goodie Bag order has been received.</p>

      <p><strong>Order Number:</strong> ${order.publicId}</p>

      <h3>Items</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;text-align:left;">Item</th>
            <th style="padding:8px;text-align:center;">Qty</th>
            <th style="padding:8px;text-align:right;">Unit Price</th>
            <th style="padding:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:8px;text-align:right;"><strong>Total</strong></td>
            <td style="padding:8px;text-align:right;"><strong>${fmt.format(order.total)}</strong></td>
          </tr>
        </tfoot>
      </table>

      ${shippingLines ? `
      <h3>Shipping Address</h3>
      <p>${shippingLines}</p>
      ` : ''}

      <hr style="margin:24px 0;">
      <p style="color:#666;font-size:14px;">
        To look up your order later, visit
        <a href="${frontendUrl}/orders/search">${frontendUrl}/orders/search</a>
        and enter your order number <strong>${order.publicId}</strong> and email address.
      </p>
    </body>
    </html>
  `;
}

// ─── Future Party Email (FEAT-004) ───────────────────────────────────────────

/**
 * Data required to send a personalised bundle link to a future party parent.
 * Requirements: AC6.4, design.md §3.6
 */
export interface FuturePartyEmailData {
  toEmail:   string;
  partyDate: string;   // 'YYYY-MM-DD'
  kidGender: 'BOY' | 'GIRL' | 'MIXED';
  bundleUrl: string;
}

const genderLabel: Record<FuturePartyEmailData['kidGender'], string> = {
  BOY:   'boy',
  GIRL:  'girl',
  MIXED: 'mixed-age group',
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'long', day: 'numeric',
});

function buildFuturePartyHtml(data: FuturePartyEmailData): string {
  const label = genderLabel[data.kidGender];
  // new Date('YYYY-MM-DD') parses as UTC midnight; add T00:00 to get local day
  const formattedDate = dateFormatter.format(new Date(`${data.partyDate}T00:00`));

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
  <h2 style="color:#F47F6B;">Your Goodie Bag is Ready!</h2>
  <p>We've curated a personalised goodie bag for your <strong>${label}</strong>
     kid's party on <strong>${formattedDate}</strong>.</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="${data.bundleUrl}"
       style="background:#F47F6B;color:#fff;padding:14px 28px;border-radius:16px;
              text-decoration:none;font-weight:600;font-size:1rem;">
      View Your Bundle
    </a>
  </p>
  <p style="color:#666;font-size:14px;">
    Or copy this link into your browser:<br>
    <a href="${data.bundleUrl}">${data.bundleUrl}</a>
  </p>
  <hr style="margin:24px 0;">
  <p style="color:#999;font-size:12px;">It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.</p>
</body>
</html>`;
}

function buildFuturePartyText(data: FuturePartyEmailData): string {
  const label = genderLabel[data.kidGender];
  const formattedDate = dateFormatter.format(new Date(`${data.partyDate}T00:00`));

  return [
    "Your Goodie Bag is Ready!",
    "",
    `We've curated a personalised goodie bag for your ${label} kid's party on ${formattedDate}.`,
    "",
    `View your bundle here: ${data.bundleUrl}`,
    "",
    "It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.",
  ].join('\n');
}

/**
 * Sends a personalised bundle link email to a future party parent.
 *
 * IMPORTANT: This function does NOT swallow errors (unlike sendOrderConfirmation).
 * If SES fails, the error propagates to the route handler which returns HTTP 500
 * so the admin knows the email was not sent and can retry.
 *
 * Requirements: AC6.3, AC6.4, AC6.5
 * Design: specs/future-party/design.md §3.6, §6
 */
export async function sendFuturePartyEmail(data: FuturePartyEmailData): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'orders@example.com';

  await sesClient.send(new SendEmailCommand({
    Destination: { ToAddresses: [data.toEmail] },
    Source: from,
    Message: {
      Subject: { Data: 'Your personalised goodie bag is ready!', Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildFuturePartyHtml(data), Charset: 'UTF-8' },
        Text: { Data: buildFuturePartyText(data), Charset: 'UTF-8' },
      },
    },
  }));
  // No try/catch — errors propagate to the admin route handler (AC6.5).
}

export async function sendOrderConfirmation(order: OrderEmailData): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'orders@example.com';

  try {
    await sesClient.send(new SendEmailCommand({
      Destination: { ToAddresses: [order.customerEmail] },
      Source: from,
      Message: {
        Subject: { Data: `Your Goodie Bag Order #${order.publicId}`, Charset: 'UTF-8' },
        Body: { Html: { Data: buildHtml(order), Charset: 'UTF-8' } },
      },
    }));
  } catch (err) {
    // Email failure must not cause the webhook to return 5xx (Stripe would retry infinitely).
    // Also handles local dev where AWS credentials may not be configured.
    console.warn('[email] Failed to send confirmation email for', order.publicId, ':', err);
  }
}
