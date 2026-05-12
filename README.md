# govbb-nisclaims

Prototype claim-status tracker for NIS benefits (sickness, employment injury, unemployment). Built on [`@govtech-bb/styles`](https://www.npmjs.com/package/@govtech-bb/styles) (alpha) loaded from unpkg. No backend — data lives in `claims.js`.

## Run

```sh
bun install
bun dev
```

Open <http://localhost:3000>.

## Try it

Enter one of these tracking numbers on the home page (or follow the disclosure on the form):

| Tracking | Claim type          | What it demonstrates                                    |
| -------- | ------------------- | ------------------------------------------------------- |
| `CL-2025-00123` | Sickness benefit       | On-track claim under review, no outstanding issues  |
| `CL-2025-00456` | Employment injury      | Delayed claim, two outstanding issues to resolve    |
| `CL-2025-00789` | Unemployment benefit   | Fully paid claim, all stages complete on time       |

## What the status page shows

- **Step bar** — horizontal indicator of which stage (X of Y) the claim is in
- **Schedule panel** — original estimate vs. revised target when delayed, with the reason for each delayed stage
- **Progress timeline** — vertical breakdown of every stage with per-stage estimate and how long it actually took / has been running
- **Outstanding issues** — only shown when present; each issue opens a dialog to resolve it
  - `missing` issues open a file-upload dialog
  - `incorrect` issues open a textarea (or structured fields when `issue.fields` is set, as the bank-details issue does, mirroring the NIS Direct Deposit Form)
- **What happens next** panel under outstanding issues, adapting copy to whether the claimant still owes information
- **Get help or report a concern** button opens a help dialog with an in-dialog confirmation on submit

## Files

| File | Purpose |
| --- | --- |
| `index.html`  | Tracking-number entry form |
| `status.html` | Status page; reads `?tracking=` from URL and renders client-side |
| `claims.js`   | Dummy claim data + lookup, date/timing helpers |
| `package.json` | `bun dev` runs `serve .` |

## Design system

For component markup, rules, and conventions when extending this prototype, load the GovBB design system skill:

- <https://govtech-bb.github.io/design-system/llm/llms.txt>

It explains class-based markup, where to fetch component docs, and the asset path gotcha (bundler vs. CDN).
