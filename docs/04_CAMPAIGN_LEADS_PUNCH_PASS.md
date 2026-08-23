# Phase 4 — Campaign + Leads + Punch Pass

## Goal

A parent scans an event QR, enters email, immediately receives a one-time Punch Pass on screen, and receives a backup email.

## Definitions

### Lead
A person who has shown interest and provided contact information, but may or may not have purchased.

### Campaign
A specific acquisition source/event, e.g. `FAIRFAX_SUMMER_FAIR_2026`.

### Redemption
A one-time field-marketing reward entitlement linked to the lead and campaign.

## Data Model

```text
Lead
- id
- normalizedEmail (unique)
- originalEmail
- phone (nullable, future)
- emailMarketingConsent
- emailMarketingConsentAt (nullable)
- smsMarketingConsent (default false)
- createdAt
- updatedAt

Campaign
- id
- code (unique)
- name
- startsAt
- endsAt
- active

Redemption
- id
- campaignId
- leadId
- token (unguessable, unique)
- shortCode (human fallback)
- status: AVAILABLE | REDEEMED
- createdAt
- redeemedAt
```

A unique constraint should prevent duplicate claims if business rule is "one pass per lead per campaign":

```text
UNIQUE(campaign_id, lead_id)
```

## Lead Capture UX

Required:
- Parent email.
- Button: Get My Punch Pass.

Separate optional checkbox:
- "Yes, send me occasional party ideas, new goodie bags and special offers."

Receiving the one-time pass must not silently imply marketing consent.

## Claim API

```http
POST /api/campaigns/{campaignCode}/claim
```

Request:

```json
{
  "email": "parent@example.com",
  "emailMarketingConsent": true
}
```

Response should include pass presentation data, not internal secrets unnecessary to the UI.

## QR Design

QR payload should contain a long random token or redemption URL.

Example concept:

```text
https://example.com/pass/<long-random-token>
```

4-character code is fallback only.

Avoid ambiguous characters if possible:
- O / 0
- I / 1
- L

## AI Can Write

- migrations/entities;
- normalized-email helper;
- unique constraints;
- claim service;
- token and short-code generator;
- QR rendering;
- campaign landing page;
- Punch Pass page;
- SES email service abstraction;
- email template;
- tests.

## Human Must Do

- create campaign names/codes;
- approve offer wording;
- approve marketing consent text;
- configure/verify real sending domain/address;
- confirm privacy-policy handling;
- test deliverability with real Gmail/Apple/Yahoo addresses;
- decide reward cost/rules.

## Acceptance Criteria

- valid campaign can issue pass;
- inactive/expired campaign cannot issue pass;
- same email casing does not create duplicate leads;
- one lead gets only the allowed number of passes per campaign;
- page shows pass without requiring email app to open;
- email contains pass/fallback code and return-to-shop CTA;
- marketing consent timestamp is stored only when consent is actually given.

## How I Should Check

### Manual
Try:
- `Amy@Gmail.com`;
- `amy@gmail.com`;
- same parent twice;
- expired campaign;
- malformed email;
- checkbox checked and unchecked;
- refresh result screen.

### Automated
- normalization tests;
- unique-claim race/concurrency test if practical;
- campaign-date tests;
- consent persistence tests;
- email service mocked at unit layer plus one staging integration test.

## Common AI Mistakes to Catch

- using email as the Redemption primary key;
- making marketing checkbox pre-checked;
- putting only the 4-character code inside QR;
- creating duplicate Lead rows for the same normalized email;
- storing unnecessary child personal information.
