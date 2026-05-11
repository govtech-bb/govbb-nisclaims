# govbb-scaffold

Minimal HTML scaffold using [`@govtech-bb/styles`](https://www.npmjs.com/package/@govtech-bb/styles) (alpha). Loads CSS + assets from unpkg; renders the official banner, alpha status banner, header, and footer.

## Run

```sh
pnpm install
pnpm dev
```

Or open `index.html` via any static server.

## Design system skill

For component markup, rules, and conventions when extending this scaffold, load the GovBB design system skill:

- [`~/Code/design-system/skills/govbb-design-system/SKILL.md`](../design-system/skills/govbb-design-system/SKILL.md)

It tells Claude (and you) how to use class-based markup, where to fetch component docs, and the asset path gotcha (bundler vs CDN).
