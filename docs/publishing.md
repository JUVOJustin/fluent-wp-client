# Publishing

This repository publishes `fluent-wp-client` to npm from the GitHub Actions deploy workflow.

## Requirements

- Add an `NPM_TOKEN` repository secret with publish access to `fluent-wp-client`
- Push a semver tag like `v1.0.0` or `1.0.0`

## Automated release

From the repository root run:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow in `.github/workflows/deploy.yml` will:

- sync `package.json` and `package-lock.json` to the tag version
- install dependencies with `npm ci`
- start the local WordPress integration environment
- run `npm test`
- stop the WordPress environment
- verify the package with `npm pack --dry-run`
- publish to npm with provenance enabled
- push the synced version files back to the default branch

## Manual fallback

If you need to publish outside GitHub Actions, run:

```bash
npm login
npm run build
npm test
npm pack --dry-run
npm publish
```
