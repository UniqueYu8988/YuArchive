import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const files = [
  'public/data/home.json',
  'public/data/games.json',
  'public/data/visions.json',
  'public/data/music.json',
  'public/data/texts.json',
  'src/data/archive_data.json',
  'src/data/site_config.json',
]

const valueRules = [
  {
    name: 'windows-user-absolute-path',
    test: value => /C:[\\/]+Users[\\/]+/i.test(value),
  },
  {
    name: 'onedrive-fragment',
    test: value => /OneDrive/i.test(value),
  },
  {
    name: 'source-data-fragment',
    test: value => /图片[\\/]+Data/i.test(value),
  },
  {
    name: 'legacy-data-backup-fragment',
    test: value => /Data backup/i.test(value),
  },
]

const keyRules = [
  {
    name: 'secret-like-field-name',
    test: key => /^(password|secret|token|api_key|apikey|access_token|refresh_token|SESSDATA)$/i.test(key),
  },
]

let failed = false

for (const relativeFile of files) {
  const absoluteFile = path.join(repoRoot, relativeFile)
  let data

  try {
    const raw = await readFile(absoluteFile, 'utf8')
    data = JSON.parse(raw)
  } catch (error) {
    failed = true
    console.log(`[FAIL] ${relativeFile}`)
    console.log(`  rule: json-readable`)
    console.log(`  path: $`)
    console.log(`  count: 1`)
    continue
  }

  const hits = new Map()
  scanJson(data, '$', hits)

  if (hits.size === 0) {
    console.log(`[PASS] ${relativeFile}`)
    console.log(`  rulesChecked: ${valueRules.length + keyRules.length}`)
    continue
  }

  failed = true
  console.log(`[FAIL] ${relativeFile}`)
  for (const [key, hit] of hits) {
    const [ruleName, jsonPath] = key.split('\u0000')
    console.log(`  rule: ${ruleName}`)
    console.log(`  path: ${jsonPath}`)
    console.log(`  count: ${hit.count}`)
  }
}

if (failed) {
  console.log('Result: generated data privacy check failed')
  process.exitCode = 1
} else {
  console.log('Result: generated data privacy check passed')
}

function scanJson(value, jsonPath, hits) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanJson(item, `${jsonPath}[${index}]`, hits)
    })
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${jsonPath}.${sanitizePathSegment(key)}`

      for (const rule of keyRules) {
        if (rule.test(key)) {
          addHit(hits, rule.name, childPath)
        }
      }

      scanJson(child, childPath, hits)
    }
    return
  }

  if (typeof value === 'string') {
    for (const rule of valueRules) {
      if (rule.test(value)) {
        addHit(hits, rule.name, jsonPath)
      }
    }
  }
}

function addHit(hits, ruleName, jsonPath) {
  const safePath = generalizeJsonPath(jsonPath)
  const key = `${ruleName}\u0000${safePath}`
  const current = hits.get(key) ?? { count: 0 }
  current.count += 1
  hits.set(key, current)
}

function sanitizePathSegment(segment) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
    return segment
  }
  return '[field]'
}

function generalizeJsonPath(jsonPath) {
  return jsonPath.replace(/\[\d+\]/g, '[]')
}
