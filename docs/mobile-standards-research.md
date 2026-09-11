# PayTsek mobile development baseline

Research date: 2026-09-09. Audience: cashiers scanning payment evidence and owners reviewing records. Horizon: current build, next release, and this quarter. Scope: capture, navigation, loading, accessibility, and resource use in the existing React Native app.

## Executive read

PayTsek's core task is capturing payment evidence quickly and checking it before saving. Direct user feedback identifies distracting navigation treatments, inconsistent colors, and repeat loading as sources of friction. The existing code provides stronger evidence for specific behavior gaps than public anecdotes about unrelated apps. Prior changes established a shared palette, plain navigation icons, cache retention, and targeted refreshes. This pass addresses lifecycle, accessible loading, and cancellation gaps that remained underneath that interface. These changes establish a practical baseline, not a certification of accessibility or production readiness.

## Ranked findings

| Priority | Goal / surface | Observed evidence | Frequency / confidence | Applied product move |
| --- | --- | --- | --- | --- |
| P1 | Scan without wasting camera resources | Scan only tracked navigation focus; it did not also gate camera mounting on app foreground state | Repeatable code path; field frequency unknown; high confidence | Unmount camera when backgrounded, reset flash/readiness, disable shutter until ready |
| P1 | Stop obsolete network work | Query cancellation did not pass an AbortSignal to the API transport | All shared query hooks affected; frequency unknown; high confidence | Forward cancellation through shared hooks and fetch, including response body reads |
| P2 | Comfortable loading and assistive navigation | Skeleton pulse ignored Reduce Motion; static list rows announced themselves as buttons | Shared components; high confidence from code | Static loading when requested, hide skeleton decoration from accessibility tree, correct row roles |
| P2 | Understand page structure while loading | Dashboard skeleton still depicted the removed three-action row | Every uncached dashboard render; high confidence | Skeleton now represents hero, grouped status, and device section |

Severity describes potential user impact, not measured incidence. User feedback in this conversation is internal evidence from one user. No production analytics, support corpus, or usability study was available.

## Sources and interpretation

- [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views?hl=en): minimum 48 × 48 dp interactive targets, meaningful semantics. Use this baseline for app controls; a smaller glyph may sit inside a larger target.
- [Android activity lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle.html): manage camera resources with lifecycle state. Applied to app foreground plus route visibility.
- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/): camera readiness and preview lifecycle. The installed Expo types also passed the implementation check.
- [React Native AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo): system Reduce Motion state and changes. Applied to skeletons in addition to existing tab transitions.
- [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation): consume the query AbortSignal to cancel underlying requests. Applied in shared query hooks and API client.
- Public search also surfaced [React Native query/navigation discussion](https://www.reddit.com/r/reactnative/comments/1r7h0gs/is_tanstack_query_strongly_nerfed_in_react/): useful discovery context for focus and cache friction, not evidence of PayTsek frequency or a technical authority.

No claim is made about public PayTsek complaints. Public discussion signal is weak and not representative; recommendations rely on official guidance plus inspected code and the user's reports. This is a focused research scan, not an exhaustive survey of all mobile standards.

## Rules for subsequent mobile changes

1. Keep Scan directly reachable with stable navigation labels and at least 48 dp touch targets. Do not add a second marker or resize selection outside its target.
2. Use shared theme roles for neutral surfaces and actions. Reserve error/warning/status colors for their meanings; always pair status with text.
3. Preserve readable cached content during background refresh. Skeletons belong to initial loads with no data, and must match current content structure.
4. Respect Reduce Motion, font scaling, safe areas, and assistive semantics. A visually disabled control must also be functionally disabled.
5. Mount camera only when visible and foregrounded, wait for readiness, request permission in context, and provide import/settings alternatives.
6. Pass cancellation signals through read requests. Keep timeout cleanup and abort listeners scoped to the entire response.
7. Keep pending receipts durable. Clear only expendable cache and confirmed uploaded copies; never use cache clearing to discard unsynced evidence.
8. Keep caching bounded, invalidate affected data after mutations, and avoid broad refreshes on every navigation/resume.

## Opportunity map

- This build: implemented the four ranked fixes above; preserved the previous cache and navigation improvements.
- Next release: test TalkBack and VoiceOver, 200% text, narrow devices, keyboard obstruction, denied permissions, real camera capture, offline retry, and workspace switching with in-flight requests. Measure repeat navigation requests and frame timing on a release build.
- This quarter: use measured scan completion time and correction rate to prioritize review-form improvements; consider encrypted persistent cache only with explicit expiry and account isolation design.
- Needs deeper research: observe cashiers completing real capture/import/review flows, including low-light and poor-network conditions. No completion-time or battery improvement has been measured yet.

## Verification

- Mobile TypeScript check passed.
- `node apps/mobile/scripts/check-api-cancellation.cjs` passed: abort during response-body read, cancellation classification, request timeout, and successful response parsing.
- Full physical-device, screen-reader, and release-performance checks remain outstanding. No blanket industry-standard compliance claim is warranted.
