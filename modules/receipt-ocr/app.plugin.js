// Expo config plugin for the OCR module. ML Kit dependencies are declared in the
// module's own build.gradle / podspec; this plugin only records the App Group id
// so the iOS module can read the share-extension staging container.
const { withInfoPlist } = require('@expo/config-plugins');

module.exports = function withReceiptOcr(config, props = {}) {
  const appGroup = props.appGroup ?? 'group.ph.paytsek.app';
  return withInfoPlist(config, (mod) => {
    mod.modResults.PayTsekAppGroup = appGroup;
    return mod;
  });
};
