# Dependency security patches

The following upstream advisories have no published fix as of 2026-10-03.
The workspace applies pnpm patches to the installed dependencies and verifies
their behavior before running the CI dependency audit. The two matching CVEs
are listed in `pnpm.auditConfig.ignoreCves` because registry audit data cannot
recognize local patches; other advisories still fail the audit.

| Dependency                   | Advisory                                                            | Local mitigation                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `braces@3.0.3`               | [CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Reject syntax nesting beyond 255 blocks while parsing and AST depth beyond 256 before compile, expand, or stringify. This also covers directly supplied ASTs and unmatched nesting.                     |
| `http-cache-semantics@4.1.1` | [CVE-2026-93748](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) | Prevent client `max-stale` from reviving entries rejected for storage, revalidation requirements, wildcard Vary, or shared-cache cookie safety. Public responses can still use explicit stale handling. |

`braces` is used by the development globbing/test/release tools.
`http-cache-semantics` is used by `gl → node-gyp → make-fetch-happen` to build
the optional native test dependency. Neither patch changes the React API.

```sh
pnpm install --frozen-lockfile --ignore-scripts
node --test __tests__/tooling/security-patches.test.mjs
pnpm audit --audit-level=low
```

Tests resolve the actual transitive dependencies used by Changesets and
node-gyp, exercise the vulnerable inputs, and check ordinary glob/cache behavior.
CI must keep the patch verification step before the audit. When upstream
publishes fixed versions, upgrade and remove the associated patch and CVE
exception together; keep the exploit regression tests.
