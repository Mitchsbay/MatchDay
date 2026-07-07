import { readFileSync } from 'node:fs';

const lockfile = readFileSync('package-lock.json', 'utf8');
const blocked = [
  'packages.applied-caas-gateway1.internal.api.openai.org',
  'internal.api.openai.org',
  'artifactory/api/npm/npm-public'
];

const matches = blocked.filter((needle) => lockfile.includes(needle));

if (matches.length > 0) {
  console.error('package-lock.json contains internal registry URLs:', matches.join(', '));
  process.exit(1);
}

console.log('Lockfile registry check passed: no internal package mirror URLs found.');
