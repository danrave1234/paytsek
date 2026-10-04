export function readAppVersion(source) {
  const version = source.match(/^\s*version:\s*['"](\d+\.\d+\.\d+)['"]/m)?.[1];
  const versionCode = Number(source.match(/^\s*versionCode:\s*(\d+)(?=\s*[,}\r\n]|$)/m)?.[1]);
  if (!version || !Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('Invalid app version/versionCode');
  return { version, versionCode };
}

export function compareVersion(a, b) {
  const left = a.replace(/^v/, '').split('.').map(Number);
  const right = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}
