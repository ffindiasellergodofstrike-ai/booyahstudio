import pages from './policies.json';
export interface PolicySection { id: string; title: string; content: string; }
export interface Policy { slug: string; title: string; subtitle: string; lastUpdated: string; quickSummary: string[]; sections: PolicySection[]; }
export type SupportedPolicySlug = string;
export const SUPPORTED_POLICY_SLUGS = pages.map(page => page.slug);
export const policyData: Record<string, Policy> = Object.fromEntries(pages.map(page => [page.slug, page]));
export const POLICY_REDIRECTS: Record<string, SupportedPolicySlug> = { 'digital-delivery': 'delivery', 'cookies': 'privacy', 'cookies-browser-storage': 'privacy', 'cookie-policy': 'privacy', 'security': 'account-security', 'payment': 'payments', 'refund-policy': 'refund', 'terms-and-conditions': 'terms' };
