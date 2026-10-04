# Token values: `--warning` for Validation Warnings

`--warning` is a new role in `src/styles/global.css`, published as `text-warning` and `border-warning` through `--color-warning` in `@theme inline`. It marks Validation Warnings (a not-Done Task missing a Duration) and is deliberately apart from `--destructive`, which marks Validation Errors. One role serves text, the warning icon and the node border, so it is held to the 4.5:1 text floor on every surface it can sit on: `--card` (Task nodes), `--sidebar` (the side panel), `--background` (the header strip) and, for good measure, `--muted` (the diagram canvas).

| Mode  | `--warning`            | vs `--background` | vs `--card` | vs `--sidebar` | vs `--muted` |
| ----- | ---------------------- | ----------------- | ----------- | -------------- | ------------ |
| light | `oklch(0.555 0.13 60)` | 4.94:1            | 4.94:1      | 4.74:1         | 4.53:1       |
| dark  | `oklch(0.82 0.16 80)`  | 11.15:1           | 10.09:1     | 10.09:1        | 8.52:1       |

Light is a dark amber: hue 60 reads as amber rather than the red of `--destructive` (hue 27), and lightness 0.555 is the lightest that keeps 4.5:1 on `--muted`. Dark is a bright amber on the near-black surfaces. Both are inside the sRGB gamut, so no browser clips them.

Contrast figures use WCAG 2 relative luminance, as in `context/archive/2026-10-04-planner-ui-contract/tokens.md`. The surfaces are achromatic, so their linear luminance is Y = L³. `--warning` is chromatic, so its Y comes from OKLCH → OKLab (a = C·cos h, b = C·sin h) → LMS (cubed) → linear sRGB, then Y = 0.2126 R + 0.7152 G + 0.0722 B. Light `--warning` gives Y = 0.1623; on `--sidebar` `oklch(0.985 0 0)` (Y = 0.9556) that is (0.9556 + 0.05) / (0.1623 + 0.05) = 4.74:1. Dark `--warning` gives Y = 0.5417; on `--card` `oklch(0.205 0 0)` (Y = 0.0086) that is (0.5417 + 0.05) / (0.0086 + 0.05) = 10.09:1.

The built stylesheet (`dist/_astro/*.css`, read after `npm run build`) carries `--warning:oklch(55.5% .13 60)` in `:root`, `--warning:oklch(82% .16 80)` in `.dark`, and the `.text-warning` and `.border-warning` utilities.
