# Reviewed dependency backports

`decode-uri-component@0.2.2.patch` backports the bounded UTF-8 scanner from
[upstream v0.5.0](https://github.com/SamVerschueren/decode-uri-component/blob/v0.5.0/index.js)
to address [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
It retains the callable CommonJS export and `+`-as-space behavior required by
Expo Router's query-string 7 dependency. The upstream package's MIT license and
copyright notice are retained by pnpm; the implementation is not relicensed.

The patch is applied by pnpm `patchedDependencies`, not a manual node_modules
edit. CI verifies the actual dependency resolved by Expo Router, normal Unicode,
legacy malformed-input behavior, query-string compatibility and a bounded
subprocess regression for long malformed input. Version-based audit tools still
report the installed 0.2.2 version; do not silently suppress that advisory.
Remove this backport after upgrading Expo's compatible dependency graph to an
official fixed version and rerun these tests before deleting them.
