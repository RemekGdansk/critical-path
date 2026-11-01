# Token values: `--done` for Done Tasks

`--done` is a new role in `src/styles/global.css`, published as `border-done`, `ring-done` and `text-done` through `--color-done` in `@theme inline`. It means only "Done": the border of a Done Task node, its ring when selected, and the check icon on its second line (`TaskNode.tsx`). The text beside the check ("Done 2026-09-03") stays in `--muted-foreground`, so a Done Task reads as finished, quieter work. It is a non-text role (a border and an icon), so its floor is the WCAG 1.4.11 non-text 3:1, against `--card` (the Task node, inside its border, under the icon) and `--muted` (the diagram canvas, outside the border).

| Mode  | `--done`               | vs `--card` (node) | vs `--muted` (canvas) | vs `--background` | vs `--sidebar` |
| ----- | ---------------------- | ------------------ | --------------------- | ----------------- | -------------- |
| light | `oklch(0.52 0.14 150)` | 5.17:1             | 4.74:1                | 5.17:1            | 4.95:1         |
| dark  | `oklch(0.72 0.17 150)` | 7.72:1             | 6.52:1                | 8.54:1            | 7.72:1         |

Both values are green (hue 150) and inside the sRGB gamut (linear RGB light 0.003 / 0.209 / 0.042, dark 0.050 / 0.534 / 0.139), so no browser clips them. Both also clear the 4.5:1 text floor on every surface, so the same role can colour text later without a new token.

The app ships no dark mode: nothing applies the `.dark` class, which stays as the shadcn default palette. The dark value is chosen and computed so a future dark mode starts correct, but it has not been seen rendered; the S-07 visual check covered light only.

In Progress has no colour role. An In Progress node's second line starts with a dashed-circle icon (after the warning icon on a warned line) and, unwarned, is in `--foreground` instead of `--muted-foreground`, so it reads apart from To Do by shape and weight, on any border, without a fifth hue on the canvas. The words "In Progress" are not drawn on the node, because they do not fit in its 180px beside a weekdays Duration; they are in the node's tooltip and its accessible name.

## Distinction from the neighbouring roles

| Mode  | Role                 | Value                       | Hue apart               | OKLab ΔE | Luminance ratio |
| ----- | -------------------- | --------------------------- | ----------------------- | -------- | --------------- |
| light | `--warning`          | `oklch(0.555 0.13 60)`      | 90°                     | 0.194    | 1.04:1          |
| light | `--critical-path`    | `oklch(0.55 0.22 264)`      | 114°                    | 0.307    | 1.01:1          |
| light | `--destructive`      | `oklch(0.577 0.245 27.325)` | 123°                    | 0.346    | 1.05:1          |
| light | `--muted-foreground` | `oklch(0.556 0 0)`          | achromatic (grey)       | 0.145    | 1.09:1          |
| light | `--primary`          | `oklch(0.205 0 0)`          | achromatic (near-black) | 0.345    | 3.47:1          |
| dark  | `--warning`          | `oklch(0.82 0.16 80)`       | 70°                     | 0.214    | 1.31:1          |
| dark  | `--critical-path`    | `oklch(0.7 0.15 264)`       | 114°                    | 0.269    | 1.17:1          |
| dark  | `--destructive`      | `oklch(0.704 0.191 22.216)` | 128°                    | 0.325    | 1.24:1          |
| dark  | `--muted-foreground` | `oklch(0.708 0 0)`          | achromatic (grey)       | 0.170    | 1.12:1          |
| dark  | `--primary`          | `oklch(0.922 0 0)`          | achromatic (near-white) | 0.264    | 1.84:1          |

The distinction from amber (`--warning`, Validation Warnings), blue (`--critical-path`) and red (`--destructive`, Validation Errors) is by hue: green sits 70° to 128° away from all three. The lightness is deliberately close to theirs, so the four read with equal weight on the canvas. The colour is not the only cue: a Done node's second line is a check icon and "Done" with its completion date in place of the Duration, so a reader who cannot see the green still tells it apart from a warned node (a warning icon and "No Duration") and a critical one (a ring as well as a border). A Done Task is never warned (it needs no Duration) and never critical (it is not remaining work), so the green border never competes with the amber or blue one on one node. Selection does not replace the state colour: a selected node keeps its border colour and gains a 3px ring in the same colour (`--primary` on a plain node), so a selected Done Task reads green and selected, and a selected critical Task blue and selected (`TaskNode.tsx`: border colour by warned, then critical, then Done, then plain; selection thickens it).

## Method

Contrast figures use WCAG 2 relative luminance, as in `context/archive/2026-10-31-critical-path-highlight/tokens.md`. The surfaces are achromatic, so their linear luminance is Y = L³. `--done` is chromatic, so its Y comes from OKLCH → OKLab (a = C·cos h, b = C·sin h) → LMS (cubed) → linear sRGB, then Y = 0.2126 R + 0.7152 G + 0.0722 B. Light `--done` gives Y = 0.1532; on `--card` `oklch(1 0 0)` (Y = 1) that is (1 + 0.05) / (0.1532 + 0.05) = 5.17:1, and on `--muted` `oklch(0.97 0 0)` (Y = 0.9127) it is (0.9127 + 0.05) / (0.1532 + 0.05) = 4.74:1. Dark `--done` gives Y = 0.4028; on `--card` `oklch(0.205 0 0)` (Y = 0.0086) that is (0.4028 + 0.05) / (0.0086 + 0.05) = 7.72:1, and on `--muted` `oklch(0.269 0 0)` (Y = 0.0195) it is (0.4028 + 0.05) / (0.0195 + 0.05) = 6.52:1. ΔE is the Euclidean distance in OKLab.
