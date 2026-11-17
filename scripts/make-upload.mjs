// Makes a folder holding exactly the files that need to go to GitHub.
//
//   npm run upload-folder
//
// It compares every project file with what is on GitHub right now and copies
// only the new and changed ones, in their folders, to "ScentMath-upload" next
// to the project. Open that folder, select everything, and drag it onto the
// repository's "Add file > Upload files" page.
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'Lonesurvivor112/ScentMath'
const BRANCH = 'main'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, '..', 'ScentMath-upload')

/** Never uploaded: installed packages, build output, and personal notes. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dev-dist', '.git'])
const SKIP_FILES = [/\.docx$/i, /^Ideas that come to mind\.txt$/i]

function listFiles(dir, prefix = '') {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...listFiles(join(dir, entry.name), rel))
    } else if (!SKIP_FILES.some((pattern) => pattern.test(entry.name))) {
      files.push(rel)
    }
  }
  return files
}

/** The id Git gives a file's contents, so local files can be matched with GitHub's. */
function gitBlobSha(path) {
  const data = readFileSync(path)
  return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
}

async function filesOnGitHub() {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers: { 'User-Agent': 'scentmath-upload-folder', Accept: 'application/vnd.github+json' } },
  )
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  const tree = await response.json()
  if (tree.truncated) throw new Error('GitHub returned a partial file list')
  return new Map(tree.tree.filter((item) => item.type === 'blob').map((item) => [item.path, item.sha]))
}

const local = listFiles(root)
let remote = null
try {
  remote = await filesOnGitHub()
} catch (error) {
  console.log(`Couldn't read the file list from GitHub (${error.message}).`)
  console.log('Copying every project file instead. Uploading them all is safe; it just takes longer.\n')
}

const added = []
const changed = []
for (const file of local) {
  if (!remote) added.push(file)
  else if (!remote.has(file)) added.push(file)
  else if (remote.get(file) !== gitBlobSha(join(root, file))) changed.push(file)
}
const gone = remote
  ? [...remote.keys()].filter(
      (file) =>
        !local.includes(file) &&
        !SKIP_FILES.some((pattern) => pattern.test(file.split('/').pop())),
    )
  : []

rmSync(out, { recursive: true, force: true })
const toCopy = [...added, ...changed]
for (const file of toCopy) {
  const target = join(out, file)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(join(root, file), target)
}

if (toCopy.length === 0) {
  console.log('GitHub already has everything. Nothing to upload.')
} else {
  console.log(`${toCopy.length} ${toCopy.length === 1 ? 'file' : 'files'} to upload, copied to:\n  ${out}\n`)
  if (changed.length > 0) console.log(`Changed (${changed.length}):\n${changed.map((f) => `  ${f}`).join('\n')}\n`)
  if (added.length > 0) console.log(`New (${added.length}):\n${added.map((f) => `  ${f}`).join('\n')}\n`)
  console.log('Next: open that folder, select everything inside it, and drag it onto')
  console.log(`  https://github.com/${REPO}/upload/${BRANCH}`)
  console.log('then click "Commit changes". GitHub rebuilds the site in a minute or two.')
  if (toCopy.length > 100) {
    console.log('\nGitHub takes at most 100 files at a time. Drag the "src" folder first, commit, then drag the rest.')
  }
}
if (gone.length > 0) {
  console.log(`\nOn GitHub but no longer in the project (delete there if you like):\n${gone.map((f) => `  ${f}`).join('\n')}`)
}
