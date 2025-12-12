## Dependabot configuration (short README)

Location
- File: `.github/dependabot.yml`

Purpose
- Keep dependencies up-to-date for the `backend` and `frontend` packages,
  and prepare the repository to receive automated updates for container images
  and GitHub Actions workflows.

What the config does for this repo
- npm: Scans `/backend` and `/frontend` weekly (Mondays). It opens up to
  10 PRs at a time and adds reviewer `garotm` and labels `dependencies` +
  `backend`/`frontend` respectively. Dev and production dependencies are
  scanned (no restriction), so expect updates for build tools, linters,
  TypeScript, test frameworks, etc.

- docker: Scans the repository root weekly. Dependabot updates Dockerfiles and
  image tags that it can find. PRs will request review from `garotm` and use
  labels `dependencies` + `infrastructure`. Note: at the time of writing there
  are no Dockerfiles in the repo (only `docker-compose.yml`), so docker PRs will
  appear once Dockerfiles or supported references are added.

- github-actions: Scans `.github/workflows` weekly for action updates. PRs will
  request review from `garotm` and use labels `dependencies` + `devops`. There
  are currently no workflow files in this repo, so no PRs will be opened until
  workflows are added.

How to change common behaviors
- Restrict to production-only updates (exclude devDependencies): add an `allow`
  block with `dependency-type: "production"` under the npm entry you want to
  limit, or remove it to allow all updates (current behavior).

- Remove or change `reviewers` if `garotm` should not be requested on PRs.

Notes and recommendations
- If you want Dependabot to update `docker-compose.yml` image tags, consult
  GitHub docs — Dependabot's primary support is for Dockerfiles and workflow
  files; handling compose files may require additional setup.
- If you add `.github/workflows`, Dependabot will automatically scan and
  propose updates for actions used in workflows.

References
- Dependabot docs: https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically
