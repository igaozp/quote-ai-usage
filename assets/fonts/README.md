# Fonts

`satori` requires a real font file to render text. Drop one **static TTF** file
here before running the app:

- `Regular.ttf` — all text (weight 400)

You can use any TTF you like as long as it covers the glyphs you render.
Variable fonts are **not** supported by satori — make sure to use a static TTF.

## Recommended: Inter

1. Download the Inter desktop zip:
   https://github.com/rsms/inter/releases (pick the latest `Inter-x.y.zip`)
2. From `Inter Desktop/`, copy:
   - `Inter-Regular.ttf` → `assets/fonts/Regular.ttf`

## Notes

- This file is gitignored — each developer / deployment provides its own.
