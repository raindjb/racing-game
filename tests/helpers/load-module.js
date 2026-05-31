/**
 * Load a racing game module into the test environment.
 * Modules are IIFEs that attach to window.R.
 * @param {string} name - module name (without .js), e.g. 'config', 'collision'
 * @returns {object} The R namespace after loading
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = resolve(__dirname, '../../src/racing/modules');

export function loadModule(name) {
  const filePath = resolve(MODULE_DIR, name + '.js');
  const code = readFileSync(filePath, 'utf8');
  // Execute the module code — IIFE will attach to window.R
  // Use indirect eval to run in global scope
  const fn = new Function(code);
  fn();
  return R;
}

export default { loadModule };
