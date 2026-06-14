import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const publicDataDir = path.join(repoRoot, 'public', 'data')

const checks = [
  {
    file: 'home.json',
    kind: 'home',
    validate(data, ctx) {
      expectObject(data, ctx, 'root')
      expectObject(data.counts, ctx, 'counts')
      for (const key of ['games', 'visions', 'music', 'texts']) {
        expectNumber(data.counts?.[key], ctx, `counts.${key}`)
      }
      for (const key of ['latestGames', 'latestVisions', 'latestMusic', 'latestTexts']) {
        expectArray(data[key], ctx, key)
      }
      return {
        counts: {
          games: safeNumber(data.counts?.games),
          visions: safeNumber(data.counts?.visions),
          music: safeNumber(data.counts?.music),
          texts: safeNumber(data.counts?.texts),
        },
        arrays: {
          latestGames: safeLength(data.latestGames),
          latestVisions: safeLength(data.latestVisions),
          latestMusic: safeLength(data.latestMusic),
          latestTexts: safeLength(data.latestTexts),
        },
      }
    },
  },
  {
    file: 'games.json',
    kind: 'timeline',
    validate(data, ctx) {
      validateTimeline(data, ctx, { requireItems: true })
      return timelineSummary(data)
    },
  },
  {
    file: 'visions.json',
    kind: 'timeline',
    validate(data, ctx) {
      validateTimeline(data, ctx, { requireItems: true, allowShowcase: true })
      return {
        ...timelineSummary(data),
        showcaseEntries: data.showcase && Array.isArray(data.showcase.entries)
          ? data.showcase.entries.length
          : 0,
      }
    },
  },
  {
    file: 'music.json',
    kind: 'music',
    validate(data, ctx) {
      expectObject(data, ctx, 'root')
      expectString(data.key, ctx, 'key')
      expectString(data.display_name, ctx, 'display_name')
      expectNumber(data.total_count, ctx, 'total_count')
      expectArray(data.items, ctx, 'items')
      expectNonEmptyArray(data.items, ctx, 'items')
      if (Array.isArray(data.items) && data.items.length > 0) {
        const sample = data.items[0]
        expectObject(sample, ctx, 'items[0]')
        expectString(sample.id, ctx, 'items[0].id')
        expectString(sample.title, ctx, 'items[0].title')
        expectString(sample.cover, ctx, 'items[0].cover')
        expectString(sample.content, ctx, 'items[0].content')
      }
      return {
        totalCount: safeNumber(data.total_count),
        items: safeLength(data.items),
      }
    },
  },
  {
    file: 'texts.json',
    kind: 'texts',
    validate(data, ctx) {
      expectObject(data, ctx, 'root')
      expectString(data.key, ctx, 'key')
      expectString(data.display_name, ctx, 'display_name')
      expectNumber(data.total_count, ctx, 'total_count')
      expectArray(data.items, ctx, 'items')
      expectNonEmptyArray(data.items, ctx, 'items')
      expectArray(data.sections, ctx, 'sections')
      if (Array.isArray(data.items) && data.items.length > 0) {
        const sample = data.items[0]
        expectObject(sample, ctx, 'items[0]')
        expectString(sample.id, ctx, 'items[0].id')
        expectString(sample.title, ctx, 'items[0].title')
        expectString(sample.content, ctx, 'items[0].content')
      }
      return {
        totalCount: safeNumber(data.total_count),
        sections: safeLength(data.sections),
        items: safeLength(data.items),
      }
    },
  },
]

let failed = false

for (const check of checks) {
  const filePath = path.join(publicDataDir, check.file)
  const ctx = { file: check.file, errors: [] }

  let data
  try {
    const raw = await readFile(filePath, 'utf8')
    data = JSON.parse(raw)
  } catch (error) {
    failed = true
    console.log(`[FAIL] ${check.file}`)
    console.log(`  topLevel: unavailable`)
    console.log(`  error: ${error instanceof SyntaxError ? 'JSON parse failed' : 'file read failed'}`)
    continue
  }

  let overview = {}
  try {
    overview = check.validate(data, ctx)
  } catch (error) {
    ctx.errors.push(error instanceof Error ? error.message : String(error))
  }

  const topLevel = Array.isArray(data) ? 'array' : typeof data
  if (ctx.errors.length > 0) {
    failed = true
    console.log(`[FAIL] ${check.file}`)
    console.log(`  topLevel: ${topLevel}`)
    for (const error of ctx.errors) {
      console.log(`  - ${error}`)
    }
    continue
  }

  console.log(`[PASS] ${check.file}`)
  console.log(`  topLevel: ${topLevel}`)
  console.log(`  kind: ${check.kind}`)
  console.log(`  overview: ${printOverview(overview)}`)
}

if (failed) {
  console.log('Result: public data shape check failed')
  process.exitCode = 1
} else {
  console.log('Result: public data shape check passed')
}

function validateTimeline(data, ctx, options = {}) {
  expectObject(data, ctx, 'root')
  expectString(data.key, ctx, 'key')
  expectString(data.display_name, ctx, 'display_name')
  expectNumber(data.total_count, ctx, 'total_count')
  expectArray(data.years, ctx, 'years')
  expectNonEmptyArray(data.years, ctx, 'years')

  if (Array.isArray(data.years)) {
    data.years.forEach((yearGroup, index) => {
      expectObject(yearGroup, ctx, `years[${index}]`)
      expectNumber(yearGroup.year, ctx, `years[${index}].year`)
      expectArray(yearGroup.items, ctx, `years[${index}].items`)
    })

    if (options.requireItems) {
      const itemCount = data.years.reduce((sum, yearGroup) => (
        sum + (Array.isArray(yearGroup?.items) ? yearGroup.items.length : 0)
      ), 0)
      if (itemCount <= 0) {
        ctx.errors.push('years must contain at least one item')
      }
    }
  }

  if (options.allowShowcase && data.showcase != null) {
    expectObject(data.showcase, ctx, 'showcase')
    expectArray(data.showcase.entries, ctx, 'showcase.entries')
  }
}

function timelineSummary(data) {
  const yearCount = safeLength(data.years)
  const itemCount = Array.isArray(data.years)
    ? data.years.reduce((sum, yearGroup) => (
      sum + (Array.isArray(yearGroup?.items) ? yearGroup.items.length : 0)
    ), 0)
    : 0
  return {
    totalCount: safeNumber(data.total_count),
    years: yearCount,
    itemsAcrossYears: itemCount,
  }
}

function expectObject(value, ctx, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    ctx.errors.push(`${field} must be an object`)
  }
}

function expectArray(value, ctx, field) {
  if (!Array.isArray(value)) {
    ctx.errors.push(`${field} must be an array`)
  }
}

function expectNonEmptyArray(value, ctx, field) {
  if (Array.isArray(value) && value.length === 0) {
    ctx.errors.push(`${field} must not be empty`)
  }
}

function expectString(value, ctx, field) {
  if (typeof value !== 'string') {
    ctx.errors.push(`${field} must be a string`)
  }
}

function expectNumber(value, ctx, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    ctx.errors.push(`${field} must be a finite number`)
  }
}

function safeLength(value) {
  return Array.isArray(value) ? value.length : 0
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function printOverview(overview) {
  return JSON.stringify(overview)
}
