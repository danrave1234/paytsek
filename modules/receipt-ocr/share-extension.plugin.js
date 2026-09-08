// Expo config plugin: adds a real iOS Share Extension target ("PayRecordShare")
// that stages shared images into the App Group container. Runs during
// `expo prebuild`; the generated ios/ folder is not committed.
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');

const TARGET = 'PayRecordShare';

function infoPlist(appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>PayRecord</string>
  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key><string>XPC!</string>
  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
  <key>PayRecordAppGroup</key><string>${appGroup}</string>
  <key>NSExtension</key><dict>
    <key>NSExtensionAttributes</key><dict>
      <key>NSExtensionActivationRule</key><dict>
        <key>NSExtensionActivationSupportsImageWithMaxCount</key><integer>1</integer>
      </dict>
    </dict>
    <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
    <key>NSExtensionPointIdentifier</key><string>com.apple.share-services</string>
  </dict>
</dict></plist>
`;
}

function entitlements(appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.application-groups</key><array><string>${appGroup}</string></array>
</dict></plist>
`;
}

module.exports = function withShareExtension(config, props = {}) {
  const appGroup = props.appGroup ?? 'group.ph.payrecord.app';
  const bundleId = props.bundleIdentifier ?? `${config.ios?.bundleIdentifier}.share`;

  config = withEntitlementsPlist(config, (mod) => {
    const groups = new Set(mod.modResults['com.apple.security.application-groups'] ?? []);
    groups.add(appGroup);
    mod.modResults['com.apple.security.application-groups'] = [...groups];
    return mod;
  });

  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const iosRoot = mod.modRequest.platformProjectRoot;
    const extDir = path.join(iosRoot, TARGET);
    fs.mkdirSync(extDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'share-extension', 'ShareViewController.swift'), path.join(extDir, 'ShareViewController.swift'));
    fs.writeFileSync(path.join(extDir, 'Info.plist'), infoPlist(appGroup));
    fs.writeFileSync(path.join(extDir, `${TARGET}.entitlements`), entitlements(appGroup));

    if (project.pbxTargetByName(TARGET)) return mod; // idempotent

    const target = project.addTarget(TARGET, 'app_extension', TARGET, bundleId);
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    const group = project.addPbxGroup(['ShareViewController.swift', 'Info.plist', `${TARGET}.entitlements`], TARGET, TARGET);
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroupId);
    project.addSourceFile('ShareViewController.swift', { target: target.uuid }, group.uuid);

    const configs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const c = configs[key];
      if (typeof c !== 'object' || !c.buildSettings) continue;
      if (c.buildSettings.PRODUCT_NAME !== `"${TARGET}"` && c.buildSettings.PRODUCT_NAME !== TARGET) continue;
      Object.assign(c.buildSettings, {
        INFOPLIST_FILE: `${TARGET}/Info.plist`,
        CODE_SIGN_ENTITLEMENTS: `${TARGET}/${TARGET}.entitlements`,
        PRODUCT_BUNDLE_IDENTIFIER: bundleId,
        SWIFT_VERSION: '5.9',
        IPHONEOS_DEPLOYMENT_TARGET: '16.0',
        TARGETED_DEVICE_FAMILY: '"1"',
        MARKETING_VERSION: config.version ?? '1.0.0',
        CURRENT_PROJECT_VERSION: '1',
        GENERATE_INFOPLIST_FILE: 'NO',
      });
    }
    return mod;
  });
};
