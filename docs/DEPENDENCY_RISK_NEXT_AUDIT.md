# SEC-2026-08-NEXT-AUDIT — production dependency risk

**Status:** remediated and qualified for controlled production deployment.
**Owner:** maintenance sprint (separate from Proposal Studio).
**Detected:** 2026-08-02 via `npm audit --omit=dev`.

## Historical audit result

The production tree reports **3 high** vulnerabilities and no critical ones:

| Package   | Installed | Dependency route         | Advisory / affected range                                                  | Fixed version available                                                                                                                                     |
| --------- | --------: | ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`    | `16.2.12` | direct dependency        | aggregator, `9.3.4-canary.0 - 16.3.0-preview.7`                            | `npm audit` proposes `next@9.3.3`; this is an incompatible downgrade, not an acceptable fix. No compatible upgrade is offered by the lockfile/audit result. |
| `postcss` |  `8.4.31` | `next@16.2.12 → postcss` | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849; `<= 8.5.17` | `8.5.18` or later upstream; consume through a supported Next upgrade after compatibility testing.                                                           |
| `sharp`   |  `0.34.5` | `next@16.2.12 → sharp`   | GHSA-f88m-g3jw-g9cj / inherited libvips CVEs; `< 0.35.0`                   | `0.35.0` or later upstream; consume through a supported Next upgrade after image regression tests.                                                          |

## Remediation and validation

- `next` and `eslint-config-next` are pinned to `16.3.0-canary.106`, the first
  available package graph that resolves `postcss@8.5.23` and `sharp@0.35.3`.
- The direct private-asset processor uses `sharp@0.35.3`; Next now deduplicates
  that version instead of installing `0.34.5` beneath its own tree.
- `npm audit --omit=dev` returned **0 vulnerabilities** on 2026-08-02.
- `npm run check`, `npm run build`, and `npm run test:e2e:production` passed
  against this exact lockfile (34 active E2E passed; one catalog test skipped
  by its deliberate feature flag).
- Do not run `npm audit fix --force`: it still proposes an unsafe downgrade to
  Next 9 rather than an update.

## Monitoring and resolution plan

1. Run `npm audit --omit=dev` before every deploy and attach its JSON summary to
   the maintenance record.
2. Keep this canary version exact; do not accept an implicit canary update.
3. Track the next stable 16.x release that carries the same dependency fixes.
   Upgrade in a dedicated branch and repeat checks, build, production E2E,
   visual checks, image paths, authentication and Project Room flows.
4. Roll back the deployment if the canary causes runtime errors, then keep the
   public release closed rather than reintroducing the vulnerable graph.

This document remains the follow-up record for replacing the qualified canary
with a stable release. The blocking audit finding itself is resolved.
