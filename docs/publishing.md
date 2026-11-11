# Publishing

Publishing needs an npm account with rights to the `inkshift` name. Nothing in this repository publishes automatically.

## Before a release

1. Check that the name is still free: `npm view inkshift`. A 404 means it is free; it was on 2026-11-11.
2. `npm run check` passes locally, and CI is green on `main`.
3. Update `CHANGELOG.md` and the version, following semver:
   - `0.x` while the API settles;
   - `1.0.0` once it has been used in at least one real app (the portfolio migration is the planned first) with no API changes needed.
4. `npm run build:lib && npm pack --dry-run`. The tarball should contain only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` and `package.json`.
5. Install the tarball into a fresh project and import `inkshift`, `inkshift/react` and `inkshift/styles.css`.

## Publish with provenance (recommended)

Use GitHub Actions with npm provenance, so the published package links back to the commit and workflow that built it.

1. On npmjs.com, configure a **trusted publisher** for `inkshift`: this repository and a workflow file, for example `release.yml`.
2. Use a workflow on `release: published` with `permissions: id-token: write, contents: read` that runs `npm ci`, `npm run check`, then `npm publish --provenance --access public`.

Without trusted publishing, publish from a clean checkout of the release tag:

```bash
npm login
npm publish --access public
```

## After publishing

- Confirm it exists: `npm view inkshift version`.
- Flip `PUBLISHED_ON_NPM` in `demo/src/links.ts`, and remove the "not yet published" note from the README.
- Tag the release: `git tag v<version> && git push --tags`.
