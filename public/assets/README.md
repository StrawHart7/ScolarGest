# Assets

Static assets served directly by Next.js from `/public`. Reference them in code as
`/assets/...` (no `public` prefix in the path).

- `images/logos/` — ScolarGest logo variants, school/partner logos if ever needed.
- `images/illustrations/` — marketing illustrations, hero graphics.
- `images/screenshots/` — real product screenshots (once available) for the landing
  page and docs. Do not use placeholder/stock screenshots here — see the honesty
  note in the landing page about not fabricating product proof.
- `icons/` — standalone icon files not covered by `lucide-react` (e.g. brand icons
  like Google's, custom favicons).
- `documents/` — downloadable PDFs (e.g. a one-pager for prospective schools),
  not user-generated documents (those are generated server-side via Playwright
  and stored in Supabase Storage, not here).
