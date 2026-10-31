# Token values: `--critical-path` for the critical path

`--critical-path` is a new role in `src/styles/global.css`, published as `border-critical-path`, `ring-critical-path` (and later `bg-critical-path` for the legend swatch) through `--color-critical-path` in `@theme inline`. It means only "on the critical path": the border and ring of a critical Task node, and the stroke and arrowhead of a critical edge. The edge is themed through React Flow's own variables, in a `.react-flow__edge.critical-path` rule in the `.react-flow` section (`--xy-edge-stroke: var(--critical-path)`, `--xy-edge-stroke-width: 2`); the arrowhead, a shared SVG marker outside the edge that no CSS rule reaches, gets `color: "var(--critical-path)"` in `flow-elements.ts`, the one documented exception, which still names the token. It is a non-text role (borders, strokes, arrowheads), so its floor is the WCAG 1.4.11 non-text 3:1, against `--muted` (the diagram canvas, under the edges) and `--card` (the Task node, inside its border).

| Mode  | `--critical-path`      | vs `--muted` (canvas) | vs `--card` (node) | vs `--background` | vs `--sidebar` |
| ----- | ---------------------- | --------------------- | ------------------ | ----------------- | -------------- |
| light | `oklch(0.55 0.22 264)` | 4.68:1                | 5.11:1             | 5.11:1            | 4.89:1         |
| dark  | `oklch(0.7 0.15 264)`  | 5.57:1                | 6.60:1             | 7.30:1            | 6.60:1         |

Both values are blue (hue 264) and inside the sRGB gamut (linear RGB light 0.024 / 0.123 / 0.865, dark 0.156 / 0.328 / 0.966), so no browser clips them. The light value also clears the 4.5:1 text floor on every surface, so the same role can colour text later without a new token.

## Distinction from the neighbouring roles

| Mode  | Role                 | Value                       | Hue apart               | OKLab ΔE | Luminance ratio |
| ----- | -------------------- | --------------------------- | ----------------------- | -------- | --------------- |
| light | `--warning`          | `oklch(0.555 0.13 60)`      | 156°                    | 0.343    | 1.03:1          |
| light | `--destructive`      | `oklch(0.577 0.245 27.325)` | 123°                    | 0.410    | 1.04:1          |
| light | `--muted-foreground` | `oklch(0.556 0 0)`          | achromatic (grey)       | 0.220    | 1.08:1          |
| light | `--primary`          | `oklch(0.205 0 0)`          | achromatic (near-black) | 0.409    | 3.51:1          |
| dark  | `--warning`          | `oklch(0.82 0.16 80)`       | 176°                    | 0.332    | 1.53:1          |
| dark  | `--destructive`      | `oklch(0.704 0.191 22.216)` | 118°                    | 0.293    | 1.06:1          |
| dark  | `--muted-foreground` | `oklch(0.708 0 0)`          | achromatic (grey)       | 0.150    | 1.05:1          |
| dark  | `--primary`          | `oklch(0.922 0 0)`          | achromatic (near-white) | 0.268    | 2.15:1          |

The distinction from amber (`--warning`, Validation Warnings) and red (`--destructive`, Validation Errors) is by hue: blue sits 118° to 176° away from both, on the far side of the hue circle. The lightness is deliberately close to theirs, so all three read with equal weight on the canvas. From the grey edges (`--muted-foreground`) the distinction is chroma (0.22 or 0.15 against 0) plus the doubled stroke width, not lightness: a reader who cannot see the blue still sees the thicker line. From the selection (`--primary` border with a `--primary` ring at 30%), it differs in both chroma and lightness, and a selected Task keeps the selection style instead of the critical one (`TaskNode.tsx`: selected, then warned, then critical, then hover). A warned Task is never critical, since the schedule is withheld while any Validation Warning exists, so the amber and blue borders never compete on one node.

## Method

Contrast figures use WCAG 2 relative luminance, as in `context/archive/2026-10-04-forecast-finish-dates/tokens.md`. The surfaces are achromatic, so their linear luminance is Y = L³. `--critical-path` is chromatic, so its Y comes from OKLCH → OKLab (a = C·cos h, b = C·sin h) → LMS (cubed) → linear sRGB, then Y = 0.2126 R + 0.7152 G + 0.0722 B. Light `--critical-path` gives Y = 0.1555; on `--muted` `oklch(0.97 0 0)` (Y = 0.9127) that is (0.9127 + 0.05) / (0.1555 + 0.05) = 4.68:1, and on `--card` `oklch(1 0 0)` (Y = 1) it is (1 + 0.05) / (0.1555 + 0.05) = 5.11:1. Dark `--critical-path` gives Y = 0.3371; on `--muted` `oklch(0.269 0 0)` (Y = 0.0195) that is (0.3371 + 0.05) / (0.0195 + 0.05) = 5.57:1, and on `--card` `oklch(0.205 0 0)` (Y = 0.0086) it is (0.3371 + 0.05) / (0.0086 + 0.05) = 6.60:1. ΔE is the Euclidean distance in OKLab.

The arrowhead keeps its usual size on the 2-unit critical stroke: React Flow markers use `markerUnits="strokeWidth"`, so `flow-elements.ts` halves the default 12.5 to 6.25 for the critical marker (6.25 × 2 = 12.5 × 1).
