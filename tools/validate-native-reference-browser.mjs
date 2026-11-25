// Static architecture guards not already covered by executable browser/dispatcher tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(repo, 'src/RulesWiki.Web/wwwroot', name), 'utf8');
for (const sheet of ['rules-core.css', 'rules-core-detail.css', 'rules-wiki-shell.css']) assert.ok(read('app.js').includes(sheet));
assert.doesNotMatch(read('api.js'), /translateLegacyPrivatePath|\/api\/wiki\/references|backend\(/);
assert.match(read('ux-shell.js'), /disabled: app.nativeReferenceOnly/);
assert.doesNotMatch(read('native-rule-detail.js'), /innerHTML|options.html/);
console.log('Restored Wiki presentation and native-only boundary checks passed.');
