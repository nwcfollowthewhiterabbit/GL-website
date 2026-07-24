# Frontend source

- `App.tsx`: route orchestration and application state.
- `components/`: route and UI components.
- `lib/`: API and routing helpers.
- `data/`: versioned storefront fallbacks/seeds.
- `main.css`: current approved visual baseline.

New work should keep route-specific behavior in focused components. Large
cross-route changes require browser screenshots at mobile and desktop widths.
ERP-managed content must keep a clear source label and safe fallback behavior.
