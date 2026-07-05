# middleware/

Cross-cutting Express middleware: `error-handler.ts` (Zod-aware 400s,
`HttpError` passthrough, 500 fallback + `notFoundHandler`) and
`tier.ts` (resolves the caller's pricing tier from the
`x-solence-tier` header → `DEFAULT_TIER` env → `pro`, attached to
`res.locals`; swap for Supabase-auth-carried plans later). Auth and
rate limiting land here when Supabase auth ships.
