import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = process.cwd();
const PUBLISH_SCRIPT = path.join(PROJECT_ROOT, '一键发布到云端.bat');
const REQUIRED_PHRASE = 'PUBLISH_LEGACY_YUARCHIVE';

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function evaluateLegacyPublishScriptGuard() {
  const exists = existsFile(PUBLISH_SCRIPT);
  const text = readTextSafe(PUBLISH_SCRIPT);
  const hasBuildStep = /build_archive\.py/i.test(text);
  const hasStageAll = /git\s+add\s+-A/i.test(text);
  const hasCommit = /git\s+commit/i.test(text);
  const hasPush = /git\s+push/i.test(text);
  const hasSetPrompt = /set\s+\/p/i.test(text);
  const hasRequiredPhrase = text.includes(REQUIRED_PHRASE);
  const hasMismatchExit = /exit\s+\/b/i.test(text) && /neq|==|if\s+not/i.test(text);
  const guarded = hasSetPrompt && hasRequiredPhrase && hasMismatchExit;

  return {
    ok: true,
    exists,
    guarded,
    requiredPhrase: REQUIRED_PHRASE,
    hasBuildStep,
    hasStageAll,
    hasCommit,
    hasPush,
    hasSetPrompt,
    hasRequiredPhrase,
    hasMismatchExit,
    riskSummary: guarded
      ? 'legacy_publish_script_has_explicit_confirmation_gate'
      : 'legacy_publish_script_can_still_be_triggered_without_exact_confirmation_gate',
  };
}

function printResult(result) {
  console.log('[PASS] Legacy publish script guard check completed');
  console.log(`  exists: ${result.exists}`);
  console.log(`  guarded: ${result.guarded}`);
  console.log(`  requiredPhrase: ${result.requiredPhrase}`);
  console.log(`  hasBuildStep: ${result.hasBuildStep}`);
  console.log(`  hasStageAll: ${result.hasStageAll}`);
  console.log(`  hasCommit: ${result.hasCommit}`);
  console.log(`  hasPush: ${result.hasPush}`);
  console.log(`  hasSetPrompt: ${result.hasSetPrompt}`);
  console.log(`  hasRequiredPhrase: ${result.hasRequiredPhrase}`);
  console.log(`  hasMismatchExit: ${result.hasMismatchExit}`);
  console.log(`Result: ${result.riskSummary}`);
}

function main() {
  const result = evaluateLegacyPublishScriptGuard();
  printResult(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
