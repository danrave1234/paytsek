import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const { RELEASE_VERSION: tag, RELEASE_VERSION_CODE: code, RELEASE_SHA: commit, APK_CERT_SHA256: certificate } = process.env;
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '') || !/^[0-9a-f]{40}$/.test(commit ?? '') || !/^[0-9a-f]{64}$/.test(certificate ?? '')) throw new Error('Invalid release provenance');
const asset = `PayTsek-${tag}.apk`;
const bytes = readFileSync(asset);
writeFileSync('release-manifest.json', `${JSON.stringify({ version: tag.slice(1), versionCode: Number(code), commit, package: 'ph.paytsek.app', asset, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), signingCertificateSha256: certificate }, null, 2)}\n`);
