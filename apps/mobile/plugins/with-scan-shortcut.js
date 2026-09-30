const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('@expo/config-plugins');

/** Adds a long-press launcher shortcut that deep-links straight to Scan. */
module.exports = function withScanShortcut(config) {
  const packageName = config.android?.package;
  if (!packageName) throw new Error('android.package is required for the PayTsek Scan shortcut');

  config = withStringsXml(config, (mod) => {
    const strings = mod.modResults.resources.string ?? [];
    const add = (name, value) => {
      if (!strings.some((entry) => entry.$?.name === name)) strings.push({ $: { name }, _: value });
    };
    add('paytsek_scan_shortcut_short', 'Scan proof');
    add('paytsek_scan_shortcut_long', 'Scan a payment proof');
    mod.modResults.resources.string = strings;
    return mod;
  });

  config = withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity['meta-data'] ??= [];
    const exists = activity['meta-data'].some((item) => item.$?.['android:name'] === 'android.app.shortcuts');
    if (!exists) {
      activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    }
    return mod;
  });

  return withDangerousMod(config, ['android', (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="scan_payment_proof"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/paytsek_scan_shortcut_short"
    android:shortcutLongLabel="@string/paytsek_scan_shortcut_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity"
      android:data="paytsek://scan" />
  </shortcut>
</shortcuts>
`);
    return mod;
  }]);
};
