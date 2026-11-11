// UK commercial cash only. Never reuse this consent for consumer, Issuing or
// another country's agreements. Keep the displayed copy and audit version aligned.
export type NativeAgreement='account'|'cash';
export const cashAgreement={
 version:'uk-business-cash-2026-07-21-v1',
 title:'Business cash account agreement',
 termsUrl:'https://stripe.com/gb/legal/ssa-service-terms#stripe-treasury-for-platforms-connected-accounts-united-kingdom',
 connectedUrl:'https://stripe.com/gb/legal/connect-account',
 consent:'I am authorised to act for this business and agree to the UK Treasury accountholder terms and the Stripe Connected Account Agreement for its business cash account.',
 disclosure:'This is an e-money financial account for business use, not a bank or savings account. Funds are safeguarded separately from Stripe’s own funds, not protected by the UK Financial Services Compensation Scheme (FSCS).',
} as const;
export function nativeAgreement(key:string):NativeAgreement|null{
 if(/^identity\.attestations\.terms_of_service\.account\.(date|ip|user_agent)$/.test(key))return 'account';
 // Requirements can retain the earlier storer name. Acceptance writes use the
 // canonical money_manager field on the 2026-09-30.preview Accounts API.
 if(/^identity\.attestations\.terms_of_service\.(storer|money_manager)\.(date|ip|user_agent)$/.test(key))return 'cash';
 return null;
}
