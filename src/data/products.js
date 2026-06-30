// Product catalog and channel definitions used in Step 1 (Campaign Setup).

export const PRODUCTS = [
  { id: 'student-card', name: 'Student Card', blurb: 'No annual fee, build credit in school.' },
  { id: 'secured-card', name: 'Secured Card', blurb: 'Refundable deposit, path to rebuild credit.' },
  { id: 'travel-rewards', name: 'Travel Rewards', blurb: 'Miles, transfer partners, premium perks.' },
  { id: 'cashback', name: 'Cashback', blurb: 'Flat or category everyday cash back.' },
  { id: 'balance-transfer', name: 'Balance Transfer', blurb: '0% intro APR to consolidate debt.' },
  { id: 'low-apr-card', name: 'Low-APR Card', blurb: 'Low ongoing rate for balance carriers.' },
]

export const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))

export const OBJECTIVES = [
  'Drive new applications (apply rate)',
  'Improve click-through to landing page',
  'Increase approved-and-activated accounts',
  'Grow qualified application starts',
  'Improve cost-per-funded-account',
  'Brand consideration / awareness',
]

// Channels carry creative constraints that the generator and screener enforce.
export const CHANNELS = [
  {
    id: 'paid-search-rsa',
    name: 'Paid Search (Google RSA)',
    fields: [
      { key: 'headline', label: 'Headline', max: 30, hint: 'Google RSA headline ≤ 30 chars' },
      { key: 'primaryText', label: 'Description', max: 90, hint: 'Google RSA description ≤ 90 chars' },
      { key: 'valueProp', label: 'Value Proposition', max: 120 },
      { key: 'landingCopy', label: 'Landing Page Copy', max: 1200 },
    ],
  },
  {
    id: 'paid-social',
    name: 'Paid Social (Meta)',
    fields: [
      { key: 'headline', label: 'Headline', max: 40, hint: 'Meta headline ~40 chars recommended' },
      { key: 'primaryText', label: 'Primary Text', max: 280, hint: 'Meta primary text — front-load value' },
      { key: 'valueProp', label: 'Value Proposition', max: 120 },
      { key: 'landingCopy', label: 'Landing Page Copy', max: 1200 },
    ],
  },
  {
    id: 'display',
    name: 'Display',
    fields: [
      { key: 'headline', label: 'Headline', max: 30 },
      { key: 'primaryText', label: 'Supporting Text', max: 90 },
      { key: 'valueProp', label: 'Value Proposition', max: 120 },
      { key: 'landingCopy', label: 'Landing Page Copy', max: 1200 },
    ],
  },
  {
    id: 'email',
    name: 'Email',
    fields: [
      { key: 'headline', label: 'Subject Line', max: 60, hint: 'Email subject ≤ 60 chars for inbox display' },
      { key: 'primaryText', label: 'Preview / Body Lead', max: 200 },
      { key: 'valueProp', label: 'Value Proposition', max: 120 },
      { key: 'landingCopy', label: 'Email Body / Landing Copy', max: 1600 },
    ],
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    fields: [
      { key: 'headline', label: 'Hero Headline', max: 70 },
      { key: 'primaryText', label: 'Subhead', max: 160 },
      { key: 'valueProp', label: 'Primary Value Prop', max: 120 },
      { key: 'landingCopy', label: 'Body / Sections', max: 2000 },
    ],
  },
]

export const CHANNELS_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]))

export function channelFields(channelId) {
  return (CHANNELS_BY_ID[channelId] || CHANNELS[0]).fields
}
