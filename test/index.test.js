let { execSync } = require('node:child_process')
let { randomUUID } = require('node:crypto')
let { copyFile, mkdir, readFile, rm, writeFile } = require('node:fs/promises')
let { tmpdir } = require('node:os')
let { join } = require('node:path')
let pico = require('picocolors')
let { test } = require('uvu')
let { equal, match, ok, throws } = require('uvu/assert')

let updateDb = require('..')

// Fix CLI tool name conflict between Yarn and Hadoop
const YARN_CMD = process.env.HADOOP_HOME ? 'yarnpkg' : 'yarn'

let yarnInstalled
try {
  execSync('yarn --version 2>/dev/null')
  yarnInstalled = true
} catch {
  process.stderr.write(
    pico.yellow('Yarn is not installed. Skipping Yarn tests\n')
  )
  yarnInstalled = false
}

let bunInstalled
try {
  execSync('bun --version 2>/dev/null')
  bunInstalled = true
} catch {
  process.stderr.write(
    pico.yellow('Bun is not installed. Skipping Bun tests\n')
  )
  bunInstalled = false
}

let denoInstalled
try {
  execSync('deno --version 2>/dev/null')
  denoInstalled = true
} catch {
  process.stderr.write(
    pico.yellow('Deno is not installed. Skipping Deno tests\n')
  )
  denoInstalled = false
}

let testDir
test.after.each(async () => {
  process.chdir(__dirname)
  await rm(testDir, { force: true, recursive: true })
})

async function chdir(fixture, ...files) {
  testDir = join(tmpdir(), `browserslist-${fixture}-${randomUUID()}`)
  await mkdir(testDir, { recursive: true })

  let from = join(__dirname, 'fixtures', fixture)
  await Promise.all(
    files.map(async i => {
      await copyFile(join(from, i), join(testDir, i))
    })
  )

  process.chdir(testDir)
  return testDir
}

function runUpdate() {
  let out = ''
  updateDb(str => {
    out += str.replace(/\x1b\[\d+m/g, '')
  })
  return out
}

function checkRunUpdateContents(installedVersions, system) {
  let addCmd = system + (system === 'yarn' ? ' add -W' : ' install')
  let rmCmd = system + (system === 'yarn' ? ' remove -W' : ' uninstall')

  match(
    runUpdate(),
    `Latest version:     ${caniuse.version}\n` +
      'Installed version' +
      (installedVersions.indexOf(',') !== -1 ? 's:' : ': ') +
      ` ${installedVersions}\n` +
      'Removing old caniuse-lite from lock file\n' +
      'Installing new caniuse-lite version\n' +
      `$ ${addCmd} caniuse-lite baseline-browser-mapping\n` +
      'Cleaning package.json dependencies from caniuse-lite\n' +
      `$ ${rmCmd} caniuse-lite baseline-browser-mapping\n` +
      'caniuse-lite has been successfully updated\n'
  )
}

function checkRunUpdateNoChanges() {
  match(
    runUpdate(),
    `Latest version:     ${caniuse.version}\n` +
      `Installed version:  ${caniuse.version}\n` +
      'caniuse-lite is up to date\n'
  )
}

let yarnLockfile1Versions =
  'caniuse-lite@^1.0.30000981, ' +
  'caniuse-lite@^1.0.30001020, caniuse-lite@^1.0.30001030:'

let yarnLockfile2Versions =
  '"caniuse-lite@npm:^1.0.30000981, ' +
  'caniuse-lite@npm:^1.0.30001020, caniuse-lite@npm:^1.0.30001030":'

async function checkYarnLockfile(dir, version) {
  let yarnLockfileVersions = yarnLockfile1Versions
  let versionSyntax = `  version "${caniuse.version}"`

  if (version === 2) {
    yarnLockfileVersions = yarnLockfile2Versions
    versionSyntax = `  version: ${caniuse.version}`
  }

  let contents = (await readFile(join(dir, 'yarn.lock'))).toString()
  match(contents, `${yarnLockfileVersions}\n`)
  match(contents, `${yarnLockfileVersions}\n` + versionSyntax)
}

let caniuse = JSON.parse(execSync('npm show caniuse-lite --json').toString())

test('throws on missing package.json', async () => {
  await chdir('update-missing')
  throws(
    runUpdate,
    'Cannot find package.json. ' +
      'Is this the right directory to run `npx update-browserslist-db` in?'
  )
})

test('throws on missing lockfile', async () => {
  await chdir('update-missing', 'package.json')
  throws(
    runUpdate,
    'No lockfile found. Run "npm install", "yarn install" or "pnpm install"'
  )
})

test('shows target browser changes', async () => {
  let dir = await chdir(
    'browserslist-diff',
    'package.json',
    'package-lock.json'
  )

  match(
    runUpdate(),
    /(Target browser changes:\n([+-] \w+ [\d.-]+\n)+)|(No target browser changes)/
  )

  let lock = JSON.parse(await readFile(join(dir, 'package-lock.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)
})

test("shows an error when browsers list can't be retrieved", async () => {
  let dir = await chdir(
    'browserslist-diff-error',
    'package.json',
    'package-lock.json'
  )

  match(
    runUpdate(),
    'Problem with browser list retrieval.\n' +
      'Target browser changes won’t be shown.\n'
  )

  let lock = JSON.parse(await readFile(join(dir, 'package-lock.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)
})

test('updates caniuse-lite without previous version', async () => {
  let dir = await chdir('update-missing', 'package.json', 'package-lock.json')
  checkRunUpdateContents('none', 'npm')

  let lock = JSON.parse(await readFile(join(dir, 'package-lock.json')))
  equal(lock.dependencies['caniuse-lite'], undefined)
})

test('updates caniuse-lite for npm', async () => {
  let dir = await chdir('update-npm', 'package.json', 'package-lock.json')
  checkRunUpdateContents('1.0.30001030', 'npm')

  let lock = JSON.parse(await readFile(join(dir, 'package-lock.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)
})

test('skips the npm update if caniuse-lite is up to date', async () => {
  let dir = await chdir('update-npm', 'package.json', 'package-lock.json')
  checkRunUpdateContents('1.0.30001030', 'npm')

  let lock = JSON.parse(await readFile(join(dir, 'package-lock.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)

  checkRunUpdateNoChanges()
  lock = JSON.parse(await readFile(join(dir, 'package-lock.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)
})

test('updates caniuse-lite for npm-shrinkwrap', async () => {
  let dir = await chdir(
    'update-npm-shrinkwrap',
    'package.json',
    'npm-shrinkwrap.json'
  )
  checkRunUpdateContents('1.0.30001030', 'npm')

  let lock = JSON.parse(await readFile(join(dir, 'npm-shrinkwrap.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)
})

test('skips the npm-shrinkwrap update if caniuse-lite is up to date', async () => {
  let dir = await chdir(
    'update-npm-shrinkwrap',
    'package.json',
    'npm-shrinkwrap.json'
  )
  checkRunUpdateContents('1.0.30001030', 'npm')
  let lock = JSON.parse(await readFile(join(dir, 'npm-shrinkwrap.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)

  checkRunUpdateNoChanges()
  lock = JSON.parse(await readFile(join(dir, 'npm-shrinkwrap.json')))
  equal(lock.dependencies['caniuse-lite'].version, caniuse.version)
})

if (yarnInstalled) {
  test('updates caniuse-lite for yarn', async () => {
    let dir = await chdir('update-yarn', 'package.json', 'yarn.lock')
    checkRunUpdateContents('1.0.30001035', 'yarn')
    checkYarnLockfile(dir)
  })

  test('updates caniuse-lite for yarn without integrity', async () => {
    let dir = await chdir(
      'update-yarn-without-integrity',
      'package.json',
      'yarn.lock'
    )
    checkRunUpdateContents('1.0.30001035', 'yarn')
    checkYarnLockfile(dir)
  })

  test('skips the yarn update if caniuse-lite is up to date', async () => {
    let dir = await chdir('update-yarn', 'package.json', 'yarn.lock')
    checkRunUpdateContents('1.0.30001035', 'yarn')
    checkYarnLockfile(dir)
    checkRunUpdateNoChanges()
    checkYarnLockfile(dir)
  })

  test('updates caniuse-lite for yarn with workspaces', async () => {
    let dir = await chdir('update-yarn-workspaces', 'package.json', 'yarn.lock')
    checkRunUpdateContents('1.0.30001156', 'yarn')
    checkYarnLockfile(dir)
  })

  if (
    !process.version.startsWith('v14.') &&
    !process.version.startsWith('v16.')
  ) {
    test('updates caniuse-lite for yarn v2', async () => {
      let dir = await chdir('update-yarn-v2', 'package.json', 'yarn.lock')
      execSync('yarn set version berry')

      // Without it Yarn will skip caniuse-lite releases younger than
      // npmMinimalAgeGate, while `yarn npm info` still reports them as the latest
      execSync(YARN_CMD + ' config set npmMinimalAgeGate 0')

      match(
        runUpdate(),
        `Latest version:     ${caniuse.version}\n` +
          'Updating caniuse-lite version\n' +
          '$ yarn up -R caniuse-lite baseline-browser-mapping\n' +
          'caniuse-lite has been successfully updated\n'
      )
      checkYarnLockfile(dir, 2)
      execSync(YARN_CMD + ' set version classic')
    })
  }
}

test('updates caniuse-lite for pnpm', async () => {
  let dir = await chdir('update-pnpm', 'package.json', 'pnpm-lock.yaml')

  // Without it pnpm will skip caniuse-lite releases younger than
  // minimumReleaseAge, while `pnpm info` still reports them as the latest
  await writeFile(join(dir, 'pnpm-workspace.yaml'), 'minimumReleaseAge: 0\n')

  match(
    runUpdate(),
    `Latest version:     ${caniuse.version}\n` +
      'Updating caniuse-lite version\n' +
      '$ pnpm up --depth=Infinity --no-save caniuse-lite\n' +
      'caniuse-lite has been successfully updated\n'
  )

  let lock = (await readFile(join(dir, 'pnpm-lock.yaml'))).toString()
  ok(
    lock.includes(`/caniuse-lite/${caniuse.version}:`) ||
      lock.includes(`caniuse-lite@${caniuse.version}:`)
  )
})

if (bunInstalled) {
  test('updates caniuse-lite for bun', async () => {
    let dir = await chdir('update-bun', 'package.json', 'bun.lockb')
    let pkgBefore = (await readFile(join(dir, 'package.json'))).toString()

    match(
      runUpdate(),
      `Latest version:     ${caniuse.version}\n` +
        'Updating caniuse-lite version\n' +
        '$ bun install (with a temporary caniuse-lite override)\n' +
        'Removing the temporary override\n' +
        '$ bun install\n' +
        'caniuse-lite has been successfully updated\n'
    )

    let dependencies = execSync('bun pm ls --all', {
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
    }).toString()
    let versions = [...dependencies.matchAll(/caniuse-lite@(\S+)/g)].map(
      i => i[1]
    )

    // Every copy has to move, including the nested ones. `bun update
    // caniuse-lite` only ever added a new hoisted copy at the latest version
    // and left those behind on the old one.
    ok(versions.length > 0)
    equal(
      versions.filter(i => i !== caniuse.version),
      []
    )

    // The override is temporary and must not survive in package.json.
    equal((await readFile(join(dir, 'package.json'))).toString(), pkgBefore)
  })
}

if (denoInstalled) {
  test('updates caniuse-lite for deno', async () => {
    let dir = await chdir('update-deno', 'package.json', 'deno.lock')

    // Without it Deno will skip caniuse-lite releases younger than
    // minimumDependencyAge, while `npm show` still reports them as the latest
    await writeFile(join(dir, 'deno.json'), '{ "minimumDependencyAge": "0" }\n')

    match(
      runUpdate(),
      `Latest version:     ${caniuse.version}\n` +
        'Updating caniuse-lite version\n' +
        '$ deno add npm:caniuse-lite npm:baseline-browser-mapping\n' +
        'Cleaning package.json dependencies from caniuse-lite\n' +
        '$ deno remove caniuse-lite baseline-browser-mapping\n' +
        'caniuse-lite has been successfully updated\n'
    )

    let lock = JSON.parse(await readFile(join(dir, 'deno.lock')))
    let key = Object.keys(lock.npm).find(k => k.startsWith('caniuse-lite@'))
    ok(key.endsWith(caniuse.version))
  })
}

test('throws error when package manager binary is missing', async () => {
  await chdir('update-bun', 'package.json', 'bun.lockb')
  let oldPath = process.env.PATH
  try {
    process.env.PATH = ''
    throws(
      () => updateDb(),
      /Cannot find bun binary in PATH/
    )
  } finally {
    process.env.PATH = oldPath
  }
})

test.run()

