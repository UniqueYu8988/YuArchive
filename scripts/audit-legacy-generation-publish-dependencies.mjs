import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = process.cwd();
const BUILD_SCRIPT = path.join(PROJECT_ROOT, 'build_archive.py');
const PUBLISH_SCRIPT = path.join(PROJECT_ROOT, '一键发布到云端.bat');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

const SCAN_ROOTS = ['scripts', 'src', 'docs'];
const DIRECT_SCAN_FILES = [
  'AGENTS.md',
  'README.md',
  'PRODUCT.md',
  'ARCHITECTURE.md',
  'CURRENT_STATE.md',
  'docs/BASELINE_ACCEPTANCE.md',
  'build_archive.py',
  '一键发布到云端.bat',
  'package.json',
];
const TEXT_EXTENSIONS = new Set(['.mjs', '.js', '.ts', '.tsx', '.py', '.bat', '.md', '.json']);

function existsFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function existsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function listDirSafe(target) {
  try {
    return fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(root) {
  const files = [];
  for (const entry of listDirSafe(root)) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(current));
    else if (entry.isFile()) files.push(current);
  }
  return files;
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function collectProjectTextFiles() {
  const files = [];
  for (const rootName of SCAN_ROOTS) {
    const root = path.join(PROJECT_ROOT, rootName);
    if (existsDir(root)) files.push(...walkFiles(root));
  }
  for (const relative of DIRECT_SCAN_FILES) {
    const target = path.join(PROJECT_ROOT, relative);
    if (existsFile(target)) files.push(target);
  }
  return [...new Set(files)].filter(file => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function has(text, pattern) {
  return pattern.test(text);
}

function classifyReference(relativePath) {
  if (relativePath === 'build_archive.py') return 'legacy_generator';
  if (relativePath === '一键发布到云端.bat') return 'legacy_publish_path';
  if (relativePath === 'package.json') return 'npm_scripts';
  if (/archive-studio/i.test(relativePath) || /smoke-test/i.test(relativePath)) return 'studio_or_smoke_safety';
  if (/audit|check|dry-run|plan|migrate|map|generate/i.test(relativePath)) return 'migration_audit_or_check';
  if (/\.md$/i.test(relativePath)) return 'documentation';
  if (/src[\\/]/i.test(relativePath)) return 'frontend_or_server_code';
  return 'other';
}

function scanReferences() {
  const patterns = [
    /ARCHIVE_SOURCE_ROOT/,
    /ONEDRIVE_DATA_ROOT/,
    /build_archive\.py/,
    /一键发布到云端/,
    /git push/,
    /git add -A/,
    /OneDrive[\\/]+图片[\\/]+Data/i,
    /C:[\\/]+Users[\\/]+Yu[\\/]+OneDrive[\\/]+图片[\\/]+Data/i,
  ];
  const byCategory = {};
  const files = [];
  for (const file of collectProjectTextFiles()) {
    const text = readTextSafe(file);
    if (!patterns.some(pattern => pattern.test(text))) continue;
    const relative = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
    const category = classifyReference(relative);
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    files.push({ file: relative, category });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { totalFiles: files.length, byCategory, files };
}

function inspectBuildScript() {
  const text = readTextSafe(BUILD_SCRIPT);
  const markers = {
    exists: existsFile(BUILD_SCRIPT),
    readsLegacyData: has(text, /ONEDRIVE_DATA_ROOT/),
    writesPublicData: has(text, /PUBLIC_DATA_DIR|HOME_JSON_OUTPUT_PATH|CATEGORY_JSON_OUTPUT_PATHS/),
    writesSrcData: has(text, /JSON_OUTPUT_PATH|SITE_CONFIG_OUTPUT_PATH/),
    writesCaches: has(text, /WEBP_CACHE_DIR|AUDIO_CACHE_DIR|MEDIA_CACHE_DIR/),
    writesReports: has(text, /REPORTS_ROOT|GAMES_INVENTORY_CSV_PATH|GAMES_TODO_CSV_PATH/),
    mayWriteSourceYaml: has(text, /sync_game_meta_template|meta_file\.write_text/),
    usesNetwork: has(text, /urlopen|Request\(/),
    usesSubprocess: has(text, /subprocess\./),
  };
  markers.riskMarkerCount = Object.entries(markers).filter(([, value]) => value === true).length;
  return markers;
}

function inspectPublishScript() {
  const text = readTextSafe(PUBLISH_SCRIPT);
  const markers = {
    exists: existsFile(PUBLISH_SCRIPT),
    runsBuildArchive: has(text, /build_archive\.py/),
    stagesAllChanges: has(text, /git\s+add\s+-A/i),
    commits: has(text, /git\s+commit/i),
    pushes: has(text, /git\s+push/i),
    hasExplicitSafetyPhrase: has(text, /CONFIRM|确认|I_UNDERSTAND|ALLOW/i),
  };
  markers.riskMarkerCount = Object.entries(markers).filter(([, value]) => value === true).length;
  return markers;
}

function inspectPackageScripts() {
  let scripts = {};
  let parseError = false;
  try {
    scripts = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).scripts ?? {};
  } catch {
    parseError = true;
  }
  const scriptText = Object.values(scripts).join('\n');
  return {
    exists: existsFile(PACKAGE_JSON),
    parseError,
    scriptNames: Object.keys(scripts),
    callsBuildArchive: /build_archive\.py/.test(scriptText),
    callsPublishScript: /一键发布到云端/.test(scriptText),
    gitPushInScripts: /git\s+push/i.test(scriptText),
  };
}

export function evaluateLegacyGenerationPublishDependencies() {
  const buildScript = inspectBuildScript();
  const publishScript = inspectPublishScript();
  const packageScripts = inspectPackageScripts();
  const references = scanReferences();

  const blockers = [];
  if (buildScript.exists && buildScript.readsLegacyData) blockers.push('legacy_generator_reads_old_data');
  if (buildScript.mayWriteSourceYaml) blockers.push('legacy_generator_can_write_source_yaml');
  if (publishScript.exists && publishScript.runsBuildArchive) blockers.push('legacy_publish_runs_legacy_generator');
  if (publishScript.stagesAllChanges || publishScript.commits || publishScript.pushes) blockers.push('legacy_publish_performs_git_write');
  if (packageScripts.callsBuildArchive || packageScripts.callsPublishScript || packageScripts.gitPushInScripts) blockers.push('npm_indirect_publish_or_generation');

  return {
    ok: true,
    retirementReady: blockers.length === 0,
    buildScript,
    publishScript,
    packageScripts,
    references,
    blockers,
    recommendation: blockers.length === 0
      ? 'no_legacy_generation_publish_blocker_detected'
      : 'keep_legacy_generation_and_publish_disabled_until_guarded_or_replaced',
  };
}

function printBooleanMap(prefix, map) {
  for (const [key, value] of Object.entries(map)) {
    if (Array.isArray(value)) console.log(`  ${prefix}${key}: ${value.length ? value.join(', ') : 'none'}`);
    else console.log(`  ${prefix}${key}: ${value}`);
  }
}

function printResult(result) {
  console.log('[PASS] Legacy generation / publish dependency audit completed');
  console.log(`  retirementReady: ${result.retirementReady}`);
  console.log(`  recommendation: ${result.recommendation}`);
  console.log('');
  console.log('build_archive.py markers:');
  printBooleanMap('', result.buildScript);
  console.log('');
  console.log('publish script markers:');
  printBooleanMap('', result.publishScript);
  console.log('');
  console.log('package scripts:');
  printBooleanMap('', result.packageScripts);
  console.log('');
  console.log(`reference files: ${result.references.totalFiles}`);
  for (const [category, count] of Object.entries(result.references.byCategory).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${category}: ${count}`);
  }
  console.log('');
  console.log(`blockers: ${result.blockers.length ? result.blockers.join(', ') : 'none'}`);
}

function main() {
  const result = evaluateLegacyGenerationPublishDependencies();
  printResult(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
