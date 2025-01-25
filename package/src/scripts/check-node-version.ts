import check from 'check-node-version';
import { resolve } from 'node:path';
import { readFileSync } from 'fs-extra';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

check(packageJson.engines, (err, result) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  if (!result.isSatisfied) {
    console.error(`
      [ERROR] The current Node.js version ${result.versions.node.version}
      does NOT satisfy the required Node.js ${packageJson.engines.node}.
    `);
    process.exit(1);
  }
});
