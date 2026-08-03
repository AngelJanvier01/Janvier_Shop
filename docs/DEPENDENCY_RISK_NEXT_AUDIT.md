# SEC-2026-08-NEXT-AUDIT — production dependency risk

**Status:** open, release-blocking for public production.
**Owner:** maintenance sprint (separate from Proposal Studio).
**Detected:** 2026-08-02 via `npm audit --omit=dev`.

## Exact audit result

The production tree reports **3 high** vulnerabilities and no critical ones:

| Package   | Installed | Dependency route         | Advisory / affected range                                                  | Fixed version available                                                                                                                                     |
| --------- | --------: | ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`    | `16.2.12` | direct dependency        | aggregator, `9.3.4-canary.0 - 16.3.0-preview.7`                            | `npm audit` proposes `next@9.3.3`; this is an incompatible downgrade, not an acceptable fix. No compatible upgrade is offered by the lockfile/audit result. |
| `postcss` |  `8.4.31` | `next@16.2.12 → postcss` | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849; `<= 8.5.17` | `8.5.18` or later upstream; consume through a supported Next upgrade after compatibility testing.                                                           |
| `sharp`   |  `0.34.5` | `next@16.2.12 → sharp`   | GHSA-f88m-g3jw-g9cj / inherited libvips CVEs; `< 0.35.0`                   | `0.35.0` or later upstream; consume through a supported Next upgrade after image regression tests.                                                          |

## Impact and current mitigation

- JANVIER does not accept user CSS or executable HTML.
- Hito A parses Markdown into a strict AST and blocks raw HTML. Hito D accepts
  only allowlisted private raster images, and the application's direct `sharp`
  dependency is now `0.35.3`.
- The remaining audit finding is the distinct nested `next -> sharp@0.34.5`
  copy and Next's pinned `postcss@8.4.31`; updating the direct asset processor
  does not remove those framework-owned copies.
- No public production deployment is approved while this issue is open.
- Do not run `npm audit fix --force`: its offered Next downgrade would be a
  materially unsafe and untested framework change.

## Monitoring and resolution plan

1. Run `npm audit --omit=dev` before every deploy and attach its JSON summary to
   the maintenance record.
2. Track the Next release channel for a compatible version that updates both
   transitives without a downgrade.
3. In a dedicated branch, update Next and lockfile together; run `npm run check`,
   `npm run build`, `npm run test:e2e:production`, visual checks, image paths,
   admin authentication, and Project Room acceptance flows.
4. Close this issue only when the production audit has no high findings or a
   documented, approved exception with a compensating control.

This document is the follow-up issue record for the current audit. It must be
resolved before JANVIER is publicly deployed.
