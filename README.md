This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Labora AI setup

Labora reads the signed-in user's notes and readable Drive files, chooses relevant excerpts, and sends them with the conversation to the selected provider. Context is capped (up to 24 sources and 72,000 characters per request); scanned images and unsupported file types are not text-indexed.

Configure provider keys in the server-only `.env.local` file (never prefix them with `NEXT_PUBLIC_`):

```bash
GEMINI_API_KEY=your_google_ai_studio_key
OPENROUTER_API_KEY=your_openrouter_key
```

The selector uses Google Gemini 3.8 Flash (`gemini-3.8-flash`, free-tier token pricing), OpenRouter Gemma 4 31B (`google/gemma-4-31b-it:free`), and LiquidAI LFM2.5-2.6B (`liquid/lfm-2.5-2.6b:free`). Both OpenRouter models have zero token cost on OpenRouter. Free-tier rate limits and model availability can change. Google documents Gemini free-tier content as potentially used to improve its products; workspace excerpts go to whichever provider is selected.

Labora enforces a **1,000,000-token monthly allowance per signed-in user**, shared across all three models. Apply `supabase/migrations/20261019000000_labora_token_quota.sql` before enabling chat; the database atomically reserves request budgets, then reconciles them with provider-reported usage. Users can see remaining tokens and the UTC monthly reset date in the chat panel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
