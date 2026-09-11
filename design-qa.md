# Design QA — PayTsek web and mobile modernization

Date: 2026-09-09

## Source of truth

- Product brief: modern, standard finance-product UI with fast comprehension and high trust.
- Pattern references: Mobbin examples from UGLYCASH, Runway, Revolut Business, and Mercury.
- Visual comparison: `.artifacts/ui-audit/07-web-reference-vs-implementation.png`.

## Implementation under test

- Route: `/`
- Build: production Next.js build served locally
- Focused capture: `.artifacts/ui-audit/05-web-production-viewport.png`
- Full-page capture: `.artifacts/ui-audit/06-web-production-full-page.png`
- Viewport: 1265 × 712
- State: signed-out public landing page, top of page

## Comparison pass

### Fonts and typography — passed

Geist is applied consistently. The large display headline has strong optical contrast with the compact body copy, card labels, and proof metadata. Line lengths and wrapping remain readable in the inspected desktop and compact layouts.

### Spacing and layout — passed

The hero uses a balanced two-column composition inside one raised shell. Section intervals are deliberate, cards share a consistent radius system, and the workflow steps have enough internal padding without becoming sparse.

### Viewport resilience — passed for inspected web states

The desktop production viewport has no visible clipping or collision. The compact navigation opens and closes correctly, and the hero collapses without overlapping controls. A broader automated breakpoint matrix is still advisable before release.

### Colors and tokens — passed

Neutral surfaces, dark ink, and one blue brand/action family replace the previous mixed blue palette. Contrast is strong in the inspected normal states, including the contained dark section and status treatments.

### Image and asset quality — passed

The hero uses the actual product interface component rather than a stock or placeholder image, so labels remain sharp at browser resolution. Mobbin imagery is pattern inspiration, not a literal target asset; the PayTsek-specific proof interface is therefore an intentional substitution rather than an omitted source asset.

### Copy and content — passed

The headline, supporting statement, calls to action, workflow labels, and evidence claims are coherent as a standalone product story. The copy is shorter and more product-first than the previous version.

### Icons — passed for the inspected surface

Visible navigation and proof-state icons are aligned and stylistically consistent. No placeholder avatars or generated decorative imagery were introduced.

### States and interactions — passed for inspected interactions

The compact navigation was opened and closed successfully. The “See the 3-step flow” action navigates to the workflow anchor. Primary and secondary actions have distinct visual priority and visible focus treatments in CSS.

### Accessibility — passed with release follow-ups

Semantic links and buttons, visible focus states, readable contrast, reduced-motion support, and practical control sizing are present. Screen reader output, zoom at 200%, and a full keyboard traversal were not instrumented in this pass.

### AI shortcut artifacts — passed

The implementation avoids decorative gradient blobs, generic testimonial avatars, and fake raster mockups. Rounded surfaces are limited to meaningful product and section groupings rather than applied indiscriminately.

## Verification

- `pnpm --filter @paytsek/web typecheck` — passed
- `pnpm --filter @paytsek/mobile typecheck` — passed
- `pnpm --filter @paytsek/web build` — passed
- `git diff --check` — passed (line-ending warnings only)

## Mobile design QA

### Source visual truth

- Existing production-shaped dashboard: `.artifacts/ui-audit/20-mobile-dashboard.png`.
- Existing records empty state: `.artifacts/ui-audit/21-mobile-records.png`.
- Product direction: content-shaped skeleton loading, stronger primary-action hierarchy, platform-native typography, consistent spacing/tokens, and recognizable Material Community icons.

### Implementation evidence

- Revised dashboard: `.artifacts/ui-audit/32-mobile-final-home.png`.
- Revised records skeleton: `.artifacts/ui-audit/23-mobile-records-v3.png`.
- Revised records empty state: `.artifacts/ui-audit/24-mobile-records-loaded.png`.
- Revised Scan state: `.artifacts/ui-audit/25-mobile-scan-v2.png`.
- Revised Review state: `.artifacts/ui-audit/26-mobile-review-v2.png`.
- Revised More hierarchy: `.artifacts/ui-audit/28-mobile-more-v3.png`.
- Dark theme: `.artifacts/ui-audit/29-mobile-home-dark.png`.
- 130% text scale: `.artifacts/ui-audit/31-mobile-text-130.png`.
- Device: Android API 36 emulator, 1080 × 2400 physical pixels, 420 dpi (approximately 411 × 914 dp), portrait.
- Density normalization: source and implementation captures use the same emulator, physical size, density, and full-screen crop; no resampling was used for judgment.
- State: authenticated owner, empty PayTsek Demo workspace. The floating gray gear is Expo development-client chrome and is excluded from app-design findings.

### Comparison history

- [P2] Navigation repeated the same destinations in both the dashboard quick-action row and the bottom bar, while Scan was not visually dominant. Fixed by removing the redundant row, ordering tabs as Home / Records / Scan / Review / More, giving Scan a filled center treatment, and using filled/outlined icon states.
- [P2] API loading used a generic centered spinner that did not preserve page structure. Fixed with animated dashboard, list, detail, and form skeleton compositions; long-running receipt OCR intentionally retains a progress indicator because completion is task-based rather than data-layout based.
- [P2] Type and spacing decisions were partly local to individual screens. Fixed with a platform-native MD3 type scale, shared spacing/radius tokens, semantic theme colors for destructive actions, and consistent page-title/subtitle treatment.
- Post-fix evidence: dashboard, loading, empty, Scan, Review, More, dark-mode, and 130%-text captures listed above. No actionable P0/P1/P2 issue remains in the inspected states.

### Required fidelity surfaces

- Fonts and typography: passed. Platform-native system families use one explicit MD3 scale with stronger display/title weights, readable body line heights, and consistent letter spacing. The 130% Android text-scale capture preserves hierarchy and navigation labels without clipping.
- Spacing and layout rhythm: passed. Screens use the shared 4/8/12/16/20/24/32/40 rhythm, 24 dp page gutters, consistent card radii, and stable bottom safe-area spacing. The simplified dashboard reveals operational status sooner.
- Colors and visual tokens: passed. Light and dark themes use the same semantic roles; destructive actions now use `theme.colors.error`, selected navigation uses `primaryContainer`, and status color is always paired with text/icon meaning.
- Image quality and asset fidelity: passed. These states contain no illustrative/raster target assets. Product icons come from the installed Material Community icon set; no emoji, text glyph, inline SVG, or placeholder art is used.
- Copy and content: passed. Tab labels are short and conventional, Scan communicates capture/import choices, Review states the decision task, and More clarifies owner-tool context.
- Icons: passed. Navigation and empty states use recognizable, optically consistent Material Community icons with filled/outlined selection states.
- States and interactions: passed for inspected states. Loading, empty, selected-tab, disabled camera, import, light/dark theme, pull-to-refresh-compatible lists, and 130% text scaling were rendered natively.
- Accessibility: passed for inspected states. Touch targets remain at least 48 dp, navigation has accessibility labels, skeletons expose polite loading labels, and status meaning does not depend on color alone.

### Focused-region comparison

Focused inspection was performed on the bottom navigation, dashboard primary action, records filter/loading region, and empty-state call to action because these contain the highest-density hierarchy and interaction changes. The same-device full-view captures were sufficient for the remaining card and typography checks.

### Verification

- `pnpm --filter @paytsek/mobile typecheck` — passed.
- `pnpm --filter @paytsek/mobile lint` — passed.
- Native Android render and primary-tab navigation — passed.
- Dark-mode render — passed.
- Android font scale at 130% — passed.

## Mobile refinement QA — floating navigation and status summary

### Source visual truth

- User-provided current-state crop: `C:/Users/Danrave/AppData/Local/Temp/codex-clipboard-4fb4f5e3-e67f-4807-b778-6565a8cc28a6.png`.
- Source pixels: 402 × 434. The source is a cropped dashboard region rather than a full device viewport.
- Requested direction: replace the solid rectangular tab bar with a fluid floating treatment, replace the generic Scan icon, and remove the AI-templated appearance created by repeated pastel icon backgrounds.

### Implementation evidence

- Full implementation: `.artifacts/ui-audit/35-mobile-home-final.png`.
- Scan interaction state: `.artifacts/ui-audit/37-mobile-scan-dock.png`.
- Same-input focused comparison: `.artifacts/ui-audit/36-summary-comparison.png`.
- Implementation pixels: 1080 × 2400 at 420 dpi, approximately 411 × 914 dp, portrait.
- Normalized comparison: the matching implementation region was cropped to 972 × 1050 physical pixels and downsampled to 402 × 434 beside the 402 × 434 source crop. This normalization was used only for focused visual judgment; the full native render was also inspected at original density.
- State: authenticated owner, light theme, empty PayTsek Demo workspace. The floating gray gear is Expo development-client chrome and is not present in a release build.

### Comparison history

- [P2] The source used three detached rounded metric cards with three separate pastel icon disks, producing excessive repetition and weak grouping. Fixed by creating one bordered status group, using hairline separators, and rendering semantic glyphs directly without decorative disks.
- [P2] The earlier bottom bar occupied the full width as a solid rectangular surface and used a generic `camera-plus` treatment for Scan. Fixed with an inset 30 dp floating dock, translucent surface, soft elevation, plain inactive icons, a dot-only selected state, and a supported `line-scan` center glyph.
- [P2] First post-fix render showed `?` for an unsupported `cellphone-message-outline` asset. Fixed by using the installed Material Community `cellphone-message` glyph without a background disk. Post-fix evidence is visible in the focused comparison and final dashboard capture.
- [P2] Absolute floating navigation could have covered page controls. Fixed by adding shared `TAB_BAR_CLEARANCE` to Home, Records, Review, Scan, and More. The Scan interaction capture shows its controls and explanatory copy ending above the dock.
- Post-fix visual evidence: no actionable P0/P1/P2 issue remains in the inspected Home and Scan states.

### Required fidelity surfaces

- Fonts and typography: passed. Platform-native family, weights, line heights, and amount alignment remain consistent; replacing “At a glance” with “Verification status” improves information scent without increasing copy density.
- Spacing and layout rhythm: passed. The grouped rows use consistent 72 dp height, 16 dp horizontal padding, shared 20 dp group radius, aligned amounts, and inset dividers. The dock clears the screen edge and persistent controls.
- Colors and visual tokens: passed. Status color is reserved for the glyph itself; the group uses neutral surface and outline tokens. The dock uses the theme surface at 95% opacity with a restrained border and shadow.
- Image quality and asset fidelity: passed. No raster imagery is required in the target region. All visible glyphs are supported Material Community icon assets; no emoji, text-symbol substitute, or hand-drawn SVG is present.
- Copy and content: passed. Status labels and record counts are unchanged, while the heading is more task-specific. Payment phone copy remains clear and product-specific.
- Icons: passed. The broken phone icon was corrected, the Scan action now uses an optically centered scan-lines glyph, and non-primary tabs no longer sit inside decorative color bubbles.
- States and interactions: passed for the inspected states. Home-to-Scan and Scan-to-Home navigation were exercised on the emulator; the selected destination state updates and the central action remains reachable.
- Accessibility: passed for the inspected states. Tab accessibility labels remain present, targets remain at least 48 dp, status meaning is not conveyed by color alone, and content is not obscured by the absolute dock.

### Full-view and focused comparison evidence

The full native dashboard and Scan captures were inspected for hierarchy, safe-area clearance, content overlap, typography, and dock balance. The source only supplied the dashboard summary crop, so exact full-screen fidelity comparison was not possible. The focused side-by-side comparison covers the dense status and Payment phone region where the requested AI-template artifact occurred; a separate full-view capture was necessary for the floating navigation because it was outside the source crop.

### Verification

- `pnpm --filter @paytsek/mobile typecheck` — passed after the final icon correction.
- `pnpm --filter @paytsek/mobile lint` — passed for the navigation/status implementation pass.
- Native Android Home / Scan / Home tab interaction — passed.
- No actionable P0/P1/P2 visual finding remains in the inspected states.

## Final result

### Scan-first follow-up

- Scan is now the initial tab and the destination after authentication/workspace selection.
- Added spring selection feedback and fading tab transitions with system Reduce Motion support.
- Replaced the capture placeholder with a dark capture surface, large shutter, direct import, flash toggle, and direct account setup action.
- Receiving-account selection now marks the selected account. Capture/import and save operations guard against repeated presses.
- Evidence: `.artifacts/ui-audit/38-scan-first.png` (native permission state) and `.artifacts/ui-audit/39-import-picker.png` (direct import opens Android photo picker). Picker cancellation was exercised.
- TypeScript and diff whitespace checks passed. Live physical-camera capture, flash hardware, and a complete receipt-to-save flow were not tested in this follow-up. Prior broad QA results above do not establish those states.

passed

---

## Scan-first redesign QA — 2026-09-11

### Source and implementation

- Selected visual direction: `.artifacts/design/paytsek-redesign-selected.png` (853 × 1844).
- Native Android scan render: `.artifacts/design/paytsek-scan-final.png` (1080 × 2400, API 36 emulator, dark mode).
- Home render: `.artifacts/design/paytsek-home-final.png`.
- Settings render: `.artifacts/design/paytsek-settings-final.png`.
- Same-input full comparison: `.artifacts/design/paytsek-scan-comparison.png`.
- Same-input focused controls comparison: `.artifacts/design/paytsek-scan-controls-comparison.png`.
- Transition recording: `.artifacts/design/paytsek-transitions.mp4`.
- State: authenticated local development session, Scan tab active, live emulator camera feed. The geometric colors inside the camera are the emulator's virtual camera scene, not app artwork.

### Comparison history

- [P1] The first automatic capture could open the correction form for an unreadable frame. Fixed: automatic captures now save only when amount, reference, provider, receipt status, and payment source are usable; otherwise the camera quietly resets and tries again.
- [P2] The flash control disappeared over a bright camera frame. Fixed with an opaque dark control surface.
- [P2] The selected direction included an account shortcut in the Scan header. Added the shortcut and verified that it routes to Settings.
- [P2] Sender and recipient rows rendered as blank placeholders when the receipt did not contain them. Fixed: those rows are omitted unless the proof actually supplies a value.

### Fidelity and behavior

- Typography and hierarchy: passed. The title, single primary scanning surface, and three-item dock preserve the selected direction's hierarchy.
- Spacing and layout: passed. No visible text or control overlap remains in the inspected Scan, Home, or Settings states; content clears the floating dock.
- Color and dark mode: passed. Screen roots, stack scenes, tab scenes, and the native launch background use the dark theme. A 90-sample transition recording had no white frame (maximum average luma 156.4; zero samples above 220).
- Camera and controls: passed. The camera has no center copy, manual capture and gallery remain available, the flash action stays legible, and the animated ring communicates automatic capture without explanatory text.
- Loading and persistence: passed. A successfully parsed record is written locally and shown immediately; upload, record creation, matching, and cache refresh continue without blocking navigation.
- Content: passed. The review state contains only amount and reference when correction is required. Sender is not inferred from unrelated OCR copy.
- Navigation: passed. Home, Scan proof, and Settings were exercised on the Android emulator. Records remains reachable from Home without adding another persistent tab.
- Accessibility: passed for inspected states. Icon-only controls expose labels, touch targets remain at least 48 dp, and system reduced-motion support remains enabled for navigation.

### Verification

- `pnpm --filter @paytsek/mobile typecheck` — passed.
- `pnpm --filter @paytsek/mobile lint` — passed.
- `pnpm --filter @paytsek/receipt-parsers test` — passed, 40 tests.
- `git diff --check -- apps/mobile packages/receipt-parsers` — passed after whitespace cleanup (line-ending notices only).
- Native Android rendering, automatic unreadable-frame retry, primary-tab navigation, and dark transition recording — passed.

No actionable P0, P1, or P2 design issue remains in the inspected states.

### Standalone release verification

- Built `.artifacts/PayTsek-0.1.8-universal.apk` with both `arm64-v8a` and `x86_64` native libraries.
- Installed that exact artifact on the API 36 emulator and cold-launched `ph.paytsek.app/.MainActivity` without Metro.
- Release launch reached the redesigned dark sign-in screen and remained the resumed activity with no fatal launch errors.
- The standalone build contains no visible Expo developer launcher control or floating gear.
- Release evidence: `.artifacts/design/paytsek-release-final.png`.
- Package metadata verified as version `0.1.8`, Android version code `7`.
- SHA-256: `A65BEDD6E85D0A4150A024042914A149FD3A7B5BD7EB06606338311B91480337`.

final result: passed
