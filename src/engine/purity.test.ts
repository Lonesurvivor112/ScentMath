import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The engine must stay pure TypeScript so it can be tested on its own and
 * reused in a native app later. This fails if any engine file imports React,
 * a store, a screen or a component.
 */

const engineDir = dirname(fileURLToPath(import.meta.url))
const dataDir = join(engineDir, '..', 'data')

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => join(dir, name))

const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])

describe('engine purity', () => {
  it('has no .tsx files', () => {
    expect(readdirSync(engineDir).filter((name) => name.endsWith('.tsx'))).toEqual([])
  })

  it('imports nothing from React or the UI layers', () => {
    const banned = /^(react|react-dom|zustand|dexie)(\/|$)|\/(store|screens|components)\//
    for (const file of [...sourceFiles(engineDir), ...sourceFiles(dataDir)]) {
      for (const specifier of importsOf(file)) {
        expect(banned.test(specifier), `${file} imports ${specifier}`).toBe(false)
      }
    }
  })

  it('has a test file for every engine module', () => {
    const names = readdirSync(engineDir)
    const modules = names.filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'testing.ts',
    )
    expect(modules.length).toBeGreaterThanOrEqual(5)
    for (const name of modules) {
      expect(names, name).toContain(name.replace(/\.ts$/, '.test.ts'))
    }
  })
})
