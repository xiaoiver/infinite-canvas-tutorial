# Dependency security patches

The following upstream advisories have no published fix as of 2026-10-28.
The workspace applies pnpm patches to the installed dependencies and verifies
their behavior before running the CI dependency audit. The matching CVEs
are listed in `pnpm.auditConfig.ignoreCves` because registry audit data cannot
recognize local patches; other advisories still fail the audit.

| Dependency                   | Advisory                                                            | Local mitigation                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `braces@3.0.3`               | [CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Reject syntax nesting beyond 255 blocks while parsing and AST depth beyond 256 before compile, expand, or stringify. This also covers directly supplied ASTs and unmatched nesting.                     |
| `deepmerge@4.3.1`            | [CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Skip prototype-related string keys before copying either input into the merged result. Jest configuration merges retain ordinary nested objects and arrays.                                             |
| `http-cache-semantics@4.1.1` | [CVE-2026-93748](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) | Prevent client `max-stale` from reviving entries rejected for storage, revalidation requirements, wildcard Vary, or shared-cache cookie safety. Public responses can still use explicit stale handling. |
| `sprintf-js@1.0.3`           | [CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | Clamp explicit numeric precision to ECMAScript limits (0–100 for fixed/exponential, 1–100 for significant digits), including values that overflow to infinity. Normal formatting remains unchanged.     |

`braces` is used by the development globbing/test/release tools.
`deepmerge` is used by Jest's development-only configuration tooling.
`http-cache-semantics` is used by `gl → node-gyp → make-fetch-happen` to build
the optional native test dependency. `sprintf-js` is used by legacy `argparse`
in Changesets/YAML tooling. None of these patches changes the React API.

```sh
pnpm install --frozen-lockfile --ignore-scripts
node --test __tests__/tooling/security-patches.test.mjs
pnpm audit --audit-level=low
```

Tests resolve the actual transitive dependencies used by Changesets and
node-gyp, exercise the vulnerable inputs, and check ordinary glob, cache and
number-formatting behavior.
CI must keep the patch verification step before the audit. When upstream
publishes fixed versions, upgrade and remove the associated patch and CVE
exception together; keep the exploit regression tests.
