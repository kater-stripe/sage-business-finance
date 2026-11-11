// Customer-facing language only. Detailed provider responses remain in the
// server audit trail; never expose credentials, internal gates or API payloads.
export function customerMessage(value:unknown){
 const text=typeof value==='string'?value:'';
 if(/\b(?:EACCES|EPERM|EROFS|ENOSPC|EDQUOT)\b/i.test(text))return 'Your demo workspace could not be opened or saved. Try again. If this continues, contact the person who shared this demo.';
 if(/tos_acceptance_on_behalf_not_allowed|cannot accept.*terms|not.*allowed.*tos/i.test(text))return 'The service agreement needs secure verification. Choose Stripe embedded form to continue on this business profile.';
 if(/captcha/i.test(text))return 'The security check could not finish. Retry the check in the verification window.';
 if(/risk_signals|session_metadata/i.test(text))return 'This check needs secure verification. Choose Stripe embedded form to continue.';
 if(/programme|program offering|money_manager|card_creator|unknown parameter|unrecognized|permission|not authorized|not authorised|404|access.*required|not.*enrolled|capability.*not.*available/i.test(text))return 'This service is not available in this sandbox yet. Your business details have been kept; no funds have moved.';
 if(/Stripe|stripe\.com|\/v[12]\/|acct_|req_|capabilit|api key|secret|client.application|preview|gate|livemode/i.test(text))return 'This action could not be completed. Refresh the status and try again, or continue with Stripe embedded form for setup.';
 return text||'This action could not be completed. Refresh the status and try again.';
}
