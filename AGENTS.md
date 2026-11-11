# Demo Boilerplate

Enclosed in this repository is the Next.js Stripe demo boilerplate used by Dory. You may make changes to the frontend and backend in `src/app/`.

## Animations

The React framework `motion` is available from `motion/react`. When designing an interface, please not only make it beautiful but make it feel alive. Ensure all animations are crisp and clean, but don't overuse animations either. Please animate elements where an animated UX is expected, such as a side panel or modal opening and closing.

## Stripe Success/Return URLs

The server's URL is not deterministic and can change between deployments. When creating Stripe objects that require success, cancel, or return URLs (e.g. Checkout Sessions, Payment Links, Account Links, etc.), the base URL MUST be passed from the browser client to the server API route/action. Never hardcode or infer the base URL on the server side — always require the client to send it (e.g. via `window.location.origin`).

### When using the Checkout Sessions API

We can't define the return URL on both the client AND when creating the Checkout Session, we must use one or the other. ALWAYS prefer the client.

## Design

Take great care in ensuring that the design of the website is beautiful, follows the user's needs, and looks uniform. Additionally, ensure that we follow web norms when creating components.

For instance:
- Checkout should happen on a separate page (not in a modal or cart panel) unless explicitly told by the user otherwise.
- Cart panels should be sticky and the user shouldn't have to scroll down to see the entire cart panel side bar.

ALWAYS use the `frontend-design` skill for complete instructions and PLAN a design before implementing it. You MUST use read this skill before planning and implementing frontend work.

ALWAYS check how brand logos and images look against their backgrounds and, if necessary and available, use an alternative image if you see poor design or poor contrast.

Where applicable, ALWAYS use the Stripe SDK's styling APIs (such as Elements `appearance`) to make embedded UI match the rest of the site's visual design. Derive colors, typography, spacing, borders, and other supported styling from the site's existing design system rather than relying on default Stripe styles.

### Cart Panels

Please take EXTREME care when writing the CSS for side panels (like cart panels). Remember, the panel should very likely be sticky and take up the entire view height where the user SHOULD NOT have to scroll down the page to see the "Checkout" (or similar) button(s).

## Integration Questions

Certain Stripe integrations require additional clarification so they're implemented properly. If a header applies, you MUST ask the user for answers to the relevant questions BEFORE implementation and additional planning work begins. Examples of how answers may alter the implementation are present in the provided references. Please add a * next to preferred defaults if you're listing options.

### If the integration uses Connect (e.g. platform, marketplace)
- Would you like to use the recommended default of V2 accounts (options: V2 accounts, V1 accounts)?
- What charge type are you using (options: Direct charges, Destination charges, Destination on behlaf-of charges, Separate charges and transfers)?
- What onboarding experience would you like to demo (options: Hosted onboarding or Embedded onboarding)?

### If the integration features a checkout experience
- What checkout integration do you want to demo (options: Hosted full page, Embedded form, Elements w/ Checkout Sessions (CS), Embedded full page, Elements w/ Payment Intents (PI)). If the user isn't sure, we should prefer Embedded form by default.

### If the integration is Hosted full page, Embedded form, Elements w/ Checkout Sessions, or Embedded full page
- Would you like to enable automatic tax?

### If the integration is a customizable Web Elements integration (Elements w/ Checkout Sessions (CS), Embedded full page, Elements w/ Payment Intents (PI))
- What elements would you like to demo (options: Payment Element, Express Checkout Element, Contact Details Element, Address Element, Payment Method Messaging Element, Tax ID Element)?

### If the integration is using Elements w/ Checkout Sessions
- Would you like to demo adaptive pricing using the Currency Selector Element?

### If the integration is using Elements
- Would you like to demo the Payment Method Messaging Element which informs customers about available Buy now, Pay later plans?

## Recommendations

Certain Stripe primitives are preferred over others. If a header applies, you MUST ask the user for answers to the relevant questions BEFORE implementation work proceeds.

### If the user wants to set an Application Fee via `application_fee_amount`
- Ensure the [Platform Pricing Tool](https://docs.stripe.com/connect/platform-pricing-tools) won't meet the user's needs first before proceeding.

## Images

Do NOT use the Next.js `Image` component from `next/image`. Always use the regular HTML `<img>` tag instead.

## Rules

<!-- BEGIN:file-edit-rules -->
# Never make changes to the following files

These files are required for the boilerplate to work properly.
- `src/instrumentation-client.ts`
- `src/app/api/client-logs/route.ts`
- `next.config.mjs`
- `CLAUDE.md`
- `AGENTS.md`
- `tsconfig.json`
- `Dockerfile`
- `.github/workflows/**`
- `src/utils/initialize-stripe.ts`
- `src/middleware.ts`
- `src/components/tools-panel-wrapper.tsx`

# Never relax crawler protections

The site-wide `noindex, nofollow` metadata in `src/app/layout.tsx` and the crawler block in `public/robots.txt` must not be removed or changed by agents.

# Never try to recreate logos, especially Stripe's

Please ask the user to upload any needed artifacts if they can't be automatically retrieved from the Demo MCP server.
<!-- END:file--rules >

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:stripe-node-sdk-rules -->
# This is NOT the Stripe (stripe-node) SDK you know

This version has breaking changes - APIs, conventions, and integrations may all differ from your training data. Read the relevant changelog in `node_modules/stripe/CHANGELOG.md` and learn available methods and APIs from `node_modules/stripe/esm`.

Keys for Stripe should be automatically loaded from the `.env` with names `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

NEVER call `new Stripe()` directly, always use `initializeStripe` from `src/utils/initialize-stripe.ts`.

ALWAYS use V2 Accounts primitives over V1 Accounts unless the user tells you otherwise.
<!-- END:stripe-node-sdk-rules >

<!-- BEGIN:stripe-connect-js-sdk-rules -->
# This is NOT the Stripe Connect.js SDK you know

This version has breaking changes - APIs, conventions, and integrations may all differ from your training data. Read `node_modules/@stripe/connect-js` and learn available methods and APIs from `node_modules/@stripe/connect-js/src`.

The publishable key  for Stripe should be automatically loaded from `.env` with name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
<!-- END:stripe-connect-js-sdk-rules >

<!-- BEGIN:stripe-react-connect-js-sdk-rules -->
# This is NOT the Stripe React Connect.js SDK you know

This version has breaking changes - APIs, conventions, and integrations may all differ from your training data. Read `node_modules/@stripe/react-connect-js` and learn available methods and APIs from `node_modules/@stripe/react-connect-js/src`.

The publishable key  for Stripe should be automatically loaded from `.env` with name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
<!-- END:stripe-react-connect-js-sdk-rules >

<!-- BEGIN:stripe-react-stripe-js-sdk-rules -->
# This is NOT the Stripe React Stripe.js SDK you know

This version has breaking changes - APIs, conventions, and integrations may all differ from your training data. Read `node_modules/@stripe/react-stripe-js` and learn available methods and APIs from `node_modules/@stripe/react-stripe-js/src`.

The publishable key  for Stripe should be automatically loaded from `.env` with name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
<!-- END:stripe-react-js-sdk-rules >

<!-- BEGIN:stripe-stripe-js-sdk-rules -->
# This is NOT the Stripe Stripe.js SDK you know

This version has breaking changes - APIs, conventions, and integrations may all differ from your training data. Read `node_modules/@stripe/stripe-js` and learn available methods and APIs from `node_modules/@stripe/stripe-js/src`.

The publishable key  for Stripe should be automatically loaded from `.env` with name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
<!-- END:stripe-stripe-js-sdk-rules >
