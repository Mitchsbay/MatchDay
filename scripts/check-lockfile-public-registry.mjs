import { readFileSync } from 'node:fs';

const lockfileText = readFileSync('package-lock.json', 'utf8');
const lockfile = JSON.parse(lockfileText);

const explicitlyBlocked = [
  'packages.applied-caas-gateway1.internal.api.openai.org',
  'internal.api.openai.org',
  'artifactory/api/npm/npm-public',
];

const blockedMatches = explicitlyBlocked.filter((needle) => lockfileText.includes(needle));
if (blockedMatches.length > 0) {
  console.error('package-lock.json contains internal registry URLs:', blockedMatches.join(', '));
  process.exit(1);
}

const invalidResolvedUrls = [];
for (const [packagePath, entry] of Object.entries(lockfile.packages ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  const resolved = entry.resolved;
  if (typeof resolved !== 'string' || resolved.length === 0) continue;

  const isPublicNpm = resolved.startsWith('https://registry.npmjs.org/');
  const isLocalFile = resolved.startsWith('file:');
  if (!isPublicNpm && !isLocalFile) {
    invalidResolvedUrls.push(`${packagePath || '<root>'}: ${resolved}`);
  }
}

if (invalidResolvedUrls.length > 0) {
  console.error('package-lock.json contains non-public npm resolved URLs:');
  for (const item of invalidResolvedUrls) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Lockfile registry check passed: all resolved package URLs use the public npm registry.');
