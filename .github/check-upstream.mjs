import { readFile } from 'node:fs/promises';

const packages = [
  'pymc',
  'pytensor',
  'arviz',
  'arviz-base',
  'arviz-stats',
  'arviz-plots',
  'pymc-extras',
  'pymc-bart',
  'preliz',
  'nutpie',
];
const baselineUrl = new URL('./upstream-releases.json', import.meta.url);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isVersion = (value) => typeof value === 'string' && value.trim().length > 0;

async function main() {
  let baseline;
  try {
    baseline = JSON.parse(await readFile(baselineUrl, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read baseline ${baselineUrl}: ${error.message}`);
  }

  if (!isObject(baseline) || Object.keys(baseline).length !== 2
      || !Object.hasOwn(baseline, 'observed_at') || !Object.hasOwn(baseline, 'versions')) {
    throw new Error(`Invalid baseline ${baselineUrl}: expected exactly observed_at and versions`);
  }
  const date = baseline.observed_at;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid baseline ${baselineUrl}: observed_at must be an ISO calendar date`);
  }
  if (!isObject(baseline.versions) || Object.keys(baseline.versions).length !== packages.length
      || !packages.every((name) => Object.hasOwn(baseline.versions, name))) {
    throw new Error(`Invalid baseline ${baselineUrl}: versions must contain exactly ${packages.join(', ')}`);
  }
  for (const name of packages) {
    if (!isVersion(baseline.versions[name])) {
      throw new Error(`Invalid baseline ${baselineUrl}: ${name} needs a nonempty version string`);
    }
  }

  console.log(`Release observations from ${date}; this baseline is not a compatibility claim.`);
  await Promise.all(packages.map(async (name) => {
    const endpoint = `https://pypi.org/pypi/${name}/json`;
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const metadata = await response.json();
      if (!isObject(metadata) || !isObject(metadata.info) || !isVersion(metadata.info.version)) {
        throw new Error('Malformed PyPI metadata: info.version must be a nonempty string');
      }
      const previous = baseline.versions[name];
      const current = metadata.info.version;
      if (current !== previous) {
        console.error(`${name}: previous=${previous} current=${current} — upstream release needs review`);
        process.exitCode = 1;
      } else {
        console.log(`${name}: unchanged (${current})`);
      }
    } catch (error) {
      console.error(`${name}: could not check ${endpoint}: ${error.message}`);
      process.exitCode = 1;
    }
  }));

  if (process.exitCode) {
    console.error('Review the reported errors and upstream release notes before manually updating the baseline.');
  }
  console.log('Baseline left unchanged; release detection does not rewrite guidance or version-targeted citations.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
