import { pick, type Rng } from './config.js';

export const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Taylor',
  'Morgan',
  'Casey',
  'Riley',
  'Quinn',
  'Avery',
  'Jamie',
  'Drew',
  'Sam',
  'Cameron',
  'Elena',
  'Marcus',
  'Priya',
  'Lucas',
  'Hannah',
  'Devon',
  'Mei-Ling',
  'Noah',
  'Sofia',
  'Tariq',
  'Chloe',
  'Kieran',
  'Amara',
  'Mateo',
  'Nadia',
  'Owen',
  'Liam',
  'Zoe',
  'Ethan',
  'Maya',
  'Victor',
  'Clara',
  'Julian',
  'Sienna',
  'Rafael',
  'Leah',
  'Isaac',
  'Nora',
  'Gabriel',
  'Ananya',
  'Theo',
  'Yuki',
  'Daniel',
  'Fatima',
  'Sebastian',
  'Aisha',
  'Caleb',
  'Eva',
] as const;

export const LAST_NAMES = [
  'Patel',
  'Kim',
  'Rivera',
  'Chen',
  'Novak',
  'Okafor',
  'Lindqvist',
  'Santos',
  'Kowalski',
  'Alvarez',
  'Bennett',
  'Foster',
  'Vance',
  'Sterling',
  'Nair',
  'Meyer',
  'Brooks',
  'Ortiz',
  'Zhou',
  'Lindholm',
  'Rossi',
  'Al-Mansoor',
  'Tremblay',
  'Gallagher',
  'Mensah',
  'Silva',
  'Petrova',
  'Takahashi',
  'Kerr',
  'Diaz',
  'Sato',
  'Mueller',
  'Bauer',
  'Haddad',
  'Cho',
  'Vargas',
  'Johansson',
  'Morales',
  'Park',
  'Bianchi',
  'Kapoor',
  'OConnor',
  'Bergstrom',
  'Navarro',
  'Richter',
  'Solis',
  'Keller',
  'Tran',
] as const;

export const COMPANY_PREFIXES = [
  'Northstar',
  'Veloce',
  'Crestline',
  'Cobalt',
  'Meridian',
  'Summit',
  'Apex',
  'Harbor',
  'Keystone',
  'Stratos',
  'Beacon',
  'Vanguard',
  'Clearwater',
  'Redwood',
  'Ironclad',
  'BlueRidge',
  'Silverline',
  'Horizon',
  'Polaris',
  'Atlas',
  'Helios',
  'Cascade',
  'Evergreen',
  'Pinnacle',
  'Solstice',
] as const;

export const COMPANY_SUFFIXES = [
  'Logistics',
  'Health',
  'Retail',
  'Analytics',
  'Cloud',
  'Financial',
  'Systems',
  'Bio',
  'Energy',
  'Media',
  'Security',
  'Commerce',
  'Manufacturing',
  'Transport',
  'Labs',
] as const;

export const DEPARTMENTS = [
  'Technical Support',
  'Billing & Payments',
  'Account & Access',
  'API & Integrations',
  'Enterprise Onboarding',
  'Security & Compliance',
] as const;

export const QUEUE_DEFS = [
  {
    name: 'Technical Support',
    slug: 'technical-support',
    description: 'FlowOps workflow failures, reporting errors, and runtime troubleshooting',
    weight: 38,
  },
  {
    name: 'Billing & Payments',
    slug: 'billing-payments',
    description: 'FlowOps subscription invoices, plan changes, refunds, and payment failures',
    weight: 27,
  },
  {
    name: 'Account & Access',
    slug: 'account-access',
    description: 'FlowOps tenant SSO, MFA resets, role permissions, and workspace provisioning',
    weight: 14,
  },
  {
    name: 'API & Integrations',
    slug: 'api-integrations',
    description: 'FlowOps order API, delivery webhooks, OAuth apps, and SDK issues',
    weight: 10,
  },
  {
    name: 'Enterprise Onboarding',
    slug: 'enterprise-onboarding',
    description: 'FlowOps enterprise tenant setup, order imports, and support handover',
    weight: 6,
  },
  {
    name: 'Security & Compliance',
    slug: 'security-compliance',
    description: 'SOC2 inquiries, audit exports, and vulnerability reports',
    weight: 5,
  },
] as const;

export const TAG_DEFS = [
  { name: 'bug', color: '#ef4444' },
  { name: 'billing', color: '#f59e0b' },
  { name: 'enterprise', color: '#8b5cf6' },
  { name: 'api', color: '#06b6d4' },
  { name: 'auth-sso', color: '#ec4899' },
  { name: 'performance', color: '#f97316' },
  { name: 'regression', color: '#dc2626' },
  { name: 'documentation', color: '#10b981' },
  { name: 'sla-breach', color: '#b91c1c' },
  { name: 'refund', color: '#d97706' },
  { name: 'webhook', color: '#0284c7' },
  { name: 'data-export', color: '#7c3aed' },
  { name: 'mobile', color: '#0d9488' },
  { name: 'onboarding', color: '#2563eb' },
] as const;

export const ISSUE_SCENARIOS = [
  {
    subject: 'SSO SAML assertion failing with clock skew error',
    error: 'ERR_SAML_ASSERTION_EXPIRED',
    component: 'Identity & SSO',
    details:
      'Users attempting to authenticate via Okta SAML are redirected back to /login with an assertion expiration error. Our IdP metadata was rotated yesterday and NTP drift is under 500ms.',
  },
  {
    subject: 'Webhook delivery delayed beyond 15-minute SLA',
    error: 'WEBHOOK_RETRY_BACKOFF_EXCEEDED',
    component: 'Event Pipeline',
    details:
      'Outbound FlowOps order.updated webhooks are arriving 18-25 minutes after the event timestamp. Our endpoint responds with HTTP 200 in <120ms, so the delay appears to be upstream in the dispatch queue.',
  },
  {
    subject: 'Monthly invoice PDF missing VAT registration number',
    error: 'INVOICE_TAX_METADATA_OMITTED',
    component: 'Billing & Invoicing',
    details:
      'Finance rejected our latest monthly invoice because the EU VAT ID saved under Organization Settings -> Tax Details was not rendered on the generated PDF document.',
  },
  {
    subject: 'API rate limit 429 returned below documented threshold',
    error: 'HTTP_429_BURST_CAP',
    component: 'Public REST API',
    details:
      'Our integration is sending ~180 requests/min against an Enterprise plan allowance of 600 req/min, yet burst traffic at the top of the hour triggers HTTP 429 Too Many Requests.',
  },
  {
    subject: 'CSV export timing out for 90-day audit log range',
    error: 'GATEWAY_TIMEOUT_504',
    component: 'Reporting & Exports',
    details:
      'Downloading the compliance audit CSV for Q3 spins for 60 seconds before failing with 504 Gateway Timeout. Smaller 7-day exports succeed without issue.',
  },
  {
    subject: 'Payment method declined despite 3DS verification',
    error: 'STRIPE_3DS_INCOMPLETE',
    component: 'Checkout & Payments',
    details:
      'Customer completed the bank 3D Secure challenge modal, but the subscription renewal remained in past_due status and no receipt was issued.',
  },
  {
    subject: 'Workspace role permissions not propagating to new members',
    error: 'RBAC_CACHE_STALE',
    component: 'Access Control',
    details:
      'Promoted three analysts from Viewer to Editor 40 minutes ago. They still receive 403 Forbidden when attempting to save FlowOps operations dashboard filters.',
  },
  {
    subject: 'OAuth refresh token returning 401 invalid_grant',
    error: 'OAUTH_REFRESH_REVOKED',
    component: 'OAuth2 Apps',
    details:
      'Background sync job refreshes tokens every 55 minutes. Since 04:00 UTC, roughly 12% of refresh calls return invalid_grant even though the user did not revoke access.',
  },
  {
    subject: 'Custom domain TLS certificate stuck in provisioning',
    error: 'ACME_DNS_CHALLENGE_PENDING',
    component: 'Custom Domains',
    details:
      'CNAME record has propagated globally across 8.8.8.8 and 1.1.1.1, but the portal still shows Certificate Provisioning Pending after 6 hours.',
  },
  {
    subject: 'Duplicate charge appeared on annual renewal',
    error: 'BILLING_IDEMPOTENCY_MISS',
    component: 'Billing & Invoicing',
    details:
      'Our corporate card statement shows two identical charges 4 minutes apart for the annual workspace renewal. Please void or refund the duplicate transaction.',
  },
  {
    subject: 'Mobile app session expiring after switching networks',
    error: 'SESSION_IP_BINDING_MISMATCH',
    component: 'Mobile Client',
    details:
      'Warehouse operators moving from office Wi-Fi to cellular LTE are logged out immediately and forced to re-enter MFA codes.',
  },
  {
    subject: 'Scheduled Monday executive digest email not delivered',
    error: 'SMTP_BOUNCE_SOFT',
    component: 'Notifications',
    details:
      'None of our 14 leadership recipients received the 07:00 UTC Monday FlowOps order summary email. Other transactional password-reset emails arrive normally.',
  },
] as const;

export const INTERNAL_COMMENTS = [
  'Checked application logs for the reported correlation window; reproducing against synthetic staging tenant.',
  'Escalated to Tier 2 platform engineering to inspect queue consumer lag and connection pool saturation.',
  'Verified customer entitlement tier and recent configuration changes in audit trail.',
  'Confirmed downstream gateway returned transient 502; retry worker recovered remaining backlog.',
  'Drafted root-cause summary and mitigation steps for customer confirmation.',
] as const;

export const PUBLIC_COMMENTS = [
  'Thank you for reporting this. We are actively investigating the issue and will share an update shortly.',
  'Could you share the approximate UTC timestamp and any request IDs from the failing responses?',
  'We identified the underlying cause and deployed a configuration fix. Could you verify on your end?',
  'Confirmed that metrics and webhooks have returned to normal levels. Marking this ticket resolved—please reopen if anything recurs.',
] as const;

export interface SyntheticCustomer {
  name: string;
  email: string;
  company: string;
}

export function buildCustomerDirectory(count: number, rng: Rng): SyntheticCustomer[] {
  const companies: Array<{ name: string; domain: string }> = [];
  for (const prefix of COMPANY_PREFIXES) {
    for (const suffix of COMPANY_SUFFIXES) {
      if (companies.length >= 180) break;
      companies.push({
        name: `${prefix} ${suffix}`,
        domain: `${prefix.toLowerCase()}-${suffix.toLowerCase()}.example.com`,
      });
    }
  }

  const customers: SyntheticCustomer[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const company = companies[i % companies.length]!;
    customers[i] = {
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}.${i + 1}@${company.domain}`,
      company: company.name,
    };
  }
  return customers;
}
