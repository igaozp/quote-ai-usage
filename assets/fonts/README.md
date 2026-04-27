# Fonts

`satori` requires real font files to render text. Drop two **static TTF** files
here before running the app:

- `Regular.ttf` — body text (weight 400)
- `Bold.ttf` — emphasized text (weight 700)

You can use any TTF you like as long as it covers the glyphs you render.
Variable fonts are **not** supported by satori — make sure to use static TTFs.

## Recommended: Inter

1. Download the Inter desktop zip:
   https://github.com/rsms/inter/releases (pick the latest `Inter-x.y.zip`)
2. From `Inter Desktop/`, copy:
   - `Inter-Regular.ttf` → `assets/fonts/Regular.ttf`
   - `Inter-Bold.ttf` → `assets/fonts/Bold.ttf`

## Notes

- These files are gitignored — each developer / deployment provides its own.
- For Cloudflare Workers we'll bundle the same TTFs as binary assets later.
