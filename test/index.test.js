let { execSync } = require('node:child_process')
let { randomUUID } = require('node:crypto')
let { copyFile, mkdir, readFile, rm, writeFile } = require('node:fs/promises')
let { tmpdir } = require('node:os')
let { delimiter, join } = require('node:path')
let pico = require('picocolors')
let { test } = require('uvu')
let { equal, match, ok, throws } = require('uvu/assert')

let updateDb = require('..')

// Fix CLI tool name conflict between Yarn and Hadoop
const YARN_CMD = process.env.HADOOP_HOME ? 'yarnpkg' : 'yarn'

// Return whether `command` is on PATH by probing `command --version`.
// `stdio: 'ignore'` hides its output cross-platform;
// a shell redirect such as `2>/dev/null` fails on Windows' cmd.exe and
// makes an installed tool look missing.
function isInstalled(command) {
  try {
    execSync(command + ' --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

let yarnInstalled = isInstalled('yarn')
if (!yarnInstalled) {
  process.stderr.write(
    pico.yellow('Yarn is not installed. Skipping Yarn tests\n')
  )
}

let bunInstalled = isInstalled('bun')
if (!bunInstalled) {
  process.stderr.write(
    pico.yellow('Bun is not installed. Skipping Bun tests\n')
  )
}

let denoInstalled = isInstalled('deno')
if (!denoInstalled) {
  process.stderr.write(
    pico.yellow('Deno is not installed. Skipping Deno tests\n')
  )
}

let pnpmMajor = Number(
  execSync('pnpm --version').toString().trim().split('.')[0]
)

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
    `Registry latest:         ${caniuse.version}\n` +
      'Installed version' +
      (installedVersions.indexOf(',') !== -1 ? 's:     ' : ':      ') +
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
    `Registry latest:         ${caniuse.version}\n` +
      `Installed version:       ${caniuse.version}\n` +
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

  // Yarn Berry writes yarn.lock with the OS-native EOL (CRLF on Windows), so
  // normalize before matching the LF-based expectations.
  let contents = (await readFile(join(dir, 'yarn.lock')))
    .toString()
    .replace(/\r\n/g, '\n')
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
        `Registry latest:         ${caniuse.version}\n` +
          'Updating caniuse-lite version\n' +
          '$ yarn up -R caniuse-lite baseline-browser-mapping\n' +
          'caniuse-lite has been successfully updated\n'
      )
      checkYarnLockfile(dir, 2)
      execSync(YARN_CMD + ' set version classic')
    })
  }
}

const OLD_CANIUSE = '1.0.30001001'

async function writePnpmConfig(
  dir,
  pin,
  minimumReleaseAge = 0,
  strict = false
) {
  if (pnpmMajor >= 11) {
    let config = `minimumReleaseAge: ${minimumReleaseAge}\n`
    if (strict) config += 'minimumReleaseAgeStrict: true\n'
    if (pin) config += `overrides:\n  caniuse-lite: ${pin}\n`
    await writeFile(join(dir, 'pnpm-workspace.yaml'), config)
  } else {
    await writeFile(join(dir, '.npmrc'), 'minimum-release-age=0\n')
    let file = join(dir, 'package.json')
    let pkg = JSON.parse((await readFile(file)).toString())
    if (pin) {
      pkg.pnpm = { overrides: { 'caniuse-lite': pin } }
    } else {
      delete pkg.pnpm
    }
    await writeFile(file, JSON.stringify(pkg, null, 2) + '\n')
  }
}

async function unpinPnpmLockfile(dir, pin) {
  let file = join(dir, 'pnpm-lock.yaml')
  let lock = (await readFile(file)).toString()
  await writeFile(
    file,
    lock.replace(`\noverrides:\n  caniuse-lite: ${pin}\n`, '')
  )
}

test('updates caniuse-lite for pnpm', async () => {
  let dir = await chdir('update-pnpm', 'package.json')

  // pnpm reads lockfiles only from a narrow range of its own versions,
  // so generate the fixture's lockfile with the pnpm we test against
  await writePnpmConfig(dir, OLD_CANIUSE)
  execSync('pnpm install --lockfile-only')
  await writePnpmConfig(dir, null)
  await unpinPnpmLockfile(dir, OLD_CANIUSE)

  let out = runUpdate()
  match(out, `Registry latest:         ${caniuse.version}\n`)
  match(out, '$ pnpm up --depth=9999 --no-save caniuse-lite')
  match(out, 'caniuse-lite has been successfully updated\n')

  let lock = (await readFile(join(dir, 'pnpm-lock.yaml'))).toString()
  ok(
    lock.includes(`/caniuse-lite/${caniuse.version}:`) ||
      lock.includes(`caniuse-lite@${caniuse.version}:`)
  )
})

function stablePublishTimes(name) {
  let times = JSON.parse(execSync(`pnpm info ${name} time --json`).toString())
  let stable = {}
  for (let version of Object.keys(times)) {
    let time = Date.parse(times[version])
    if (/^\d+\.\d+\.\d+$/.test(version) && Number.isFinite(time)) {
      stable[version] = time
    }
  }
  return stable
}

if (pnpmMajor >= 11) {
  test('respects strict pnpm minimumReleaseAge', async () => {
    let dir = await chdir('update-pnpm', 'package.json')

    // Pick an age gate that is just too strict for the latest release,
    // so the previous mature release has to be installed instead
    let times = stablePublishTimes('caniuse-lite')
    let minutes = Math.ceil((Date.now() - times[caniuse.version]) / 60000) + 1
    let cutoff = Date.now() - minutes * 60000
    let expected = Object.keys(times)
      .filter(version => times[version] <= cutoff)
      .reduce((a, b) => (times[a] > times[b] ? a : b))
    ok(expected !== caniuse.version)

    // The fixture’s lockfile must obey the same age gate, like a real
    // project where `pnpm install` already passed under these settings
    await writePnpmConfig(dir, OLD_CANIUSE, minutes, true)
    execSync('pnpm install --lockfile-only')
    await writePnpmConfig(dir, null, minutes, true)
    await unpinPnpmLockfile(dir, OLD_CANIUSE)

    let packageBefore = await readFile(join(dir, 'package.json'))
    let workspaceBefore = await readFile(join(dir, 'pnpm-workspace.yaml'))
    let out = runUpdate()

    match(out, `Registry latest:         ${caniuse.version}\n`)

    // `pnpm up --no-save` rejects the strict age gate only in pnpm
    // 12.0.0–12.4.1, where update-db falls back to manual overrides. Every
    // other release (11.x, 12.4.2+) resolves the update itself, so the
    // fallback never runs. Assert whichever path this pnpm actually took.
    if (out.includes('Strict pnpm minimumReleaseAge detected\n')) {
      match(out, `Latest policy-compliant: ${expected}\n`)
      match(out, '$ pnpm install --lockfile-only (with')
      match(out, '$ pnpm install --no-frozen-lockfile\n')
      equal(await readFile(join(dir, 'package.json')), packageBefore)
      equal(await readFile(join(dir, 'pnpm-workspace.yaml')), workspaceBefore)

      // The fallback pins the mature version through overrides, so the
      // lockfile lands on it exactly regardless of registry metadata
      let lock = (await readFile(join(dir, 'pnpm-lock.yaml'))).toString()
      ok(
        lock.includes(`/caniuse-lite/${expected}:`) ||
          lock.includes(`caniuse-lite@${expected}:`)
      )
      ok(!lock.includes(`caniuse-lite/${caniuse.version}`))
      ok(!lock.includes(`caniuse-lite@${caniuse.version}`))
    } else {
      // pnpm handled the update natively, so the strict fallback must not have
      // run. `--no-save` leaves package.json untouched. The exact resolved
      // version depends on whether the registry served per-version publish
      // times (pnpm#13741), so it is not asserted — but the lockfile must have
      // moved off the old pinned version, proving an update actually happened.
      match(out, 'caniuse-lite has been successfully updated\n')
      ok(!out.includes('Strict pnpm minimumReleaseAge detected'))
      equal(await readFile(join(dir, 'package.json')), packageBefore)
      let lock = (await readFile(join(dir, 'pnpm-lock.yaml'))).toString()
      ok(!lock.includes(OLD_CANIUSE))
    }
  })

  test('fails closed when pnpm has no mature caniuse-lite version', async () => {
    let dir = await chdir('update-pnpm', 'package.json')

    await writePnpmConfig(dir, OLD_CANIUSE)
    execSync('pnpm install --lockfile-only')
    await writePnpmConfig(dir, null, 52560000, true)
    await unpinPnpmLockfile(dir, OLD_CANIUSE)

    let packageBefore = await readFile(join(dir, 'package.json'))
    let lockBefore = await readFile(join(dir, 'pnpm-lock.yaml'))
    let workspaceBefore = await readFile(join(dir, 'pnpm-workspace.yaml'))

    throws(
      runUpdate,
      /Cannot find a caniuse-lite version old enough for pnpm minimumReleaseAge/
    )
    equal(await readFile(join(dir, 'package.json')), packageBefore)
    equal(await readFile(join(dir, 'pnpm-lock.yaml')), lockBefore)
    equal(await readFile(join(dir, 'pnpm-workspace.yaml')), workspaceBefore)
  })
}

if (bunInstalled) {
  test('updates caniuse-lite for bun', async () => {
    let dir = await chdir('update-bun', 'package.json', 'bun.lockb')
    let pkgBefore = (await readFile(join(dir, 'package.json'))).toString()

    match(
      runUpdate(),
      `Registry latest:         ${caniuse.version}\n` +
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
      `Registry latest:         ${caniuse.version}\n` +
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
    throws(() => updateDb(), /Cannot find bun binary in PATH/)
  } finally {
    process.env.PATH = oldPath
  }
})

// Shadow yarn on PATH with a fake that reports a Berry version, so index.js
// hits the classic/Berry mismatch before ever running the v1-only `yarn info`.
// Unlike the `#!/bin/sh` shims below, this one runs on Windows too: cmd.exe
// resolves a `yarn.cmd` via PATHEXT, so the test covers the Berry branch on
// the platform where the bug was actually reported.
test('reports Yarn Berry on a v1 lockfile', async () => {
  let dir = await chdir('update-yarn', 'package.json', 'yarn.lock')
  let binDir = join(dir, 'bin')
  await mkdir(binDir)
  if (process.platform === 'win32') {
    await writeFile(join(binDir, 'yarn.cmd'), '@echo 4.9.1\n')
  } else {
    await writeFile(join(binDir, 'yarn'), '#!/bin/sh\necho 4.9.1\n', {
      mode: 0o755
    })
  }
  let oldPath = process.env.PATH
  try {
    process.env.PATH = binDir + delimiter + oldPath
    throws(() => updateDb(), /Yarn v1 \(classic\) lockfile, but .* Berry/)
  } finally {
    process.env.PATH = oldPath
  }
})

// Shadow npm on PATH with a fake that exits non-zero (but is not "missing"),
// so getLatestInfo's catch must rethrow the raw "Command failed" error rather
// than mistake it for an absent binary. On Windows this guards the branch that
// tells a real failure (exit 1) apart from a missing binary (exit 9009 / "is
// not recognized"), so it runs there too via a `.cmd` shim resolved by PATHEXT.
test('rethrows package manager errors', async () => {
  let dir = await chdir('update-npm', 'package.json', 'package-lock.json')
  let binDir = join(dir, 'bin')
  await mkdir(binDir)
  if (process.platform === 'win32') {
    await writeFile(join(binDir, 'npm.cmd'), '@exit /b 1\n')
  } else {
    await writeFile(join(binDir, 'npm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
  }
  let oldPath = process.env.PATH
  try {
    process.env.PATH = binDir + delimiter + oldPath
    throws(() => updateDb(), /Command failed/)
  } finally {
    process.env.PATH = oldPath
  }
})

// A real failure whose output happens to mention that some *other* binary is
// not recognized must still be rethrown, not swallowed as "npm is missing".
// The classifier anchors the phrase to the binary it launched, so `'webpack'
// is not recognized` (from a hypothetical nested call) does not match `npm`.
test('rethrows errors that mention an unrelated missing command', async () => {
  let dir = await chdir('update-npm', 'package.json', 'package-lock.json')
  let binDir = join(dir, 'bin')
  await mkdir(binDir)
  let message =
    "'webpack' is not recognized as an internal or external command"
  if (process.platform === 'win32') {
    await writeFile(join(binDir, 'npm.cmd'), '@echo ' + message + '\n@exit /b 1\n')
  } else {
    await writeFile(join(binDir, 'npm'), '#!/bin/sh\necho "' + message + '"\nexit 1\n', {
      mode: 0o755
    })
  }
  let oldPath = process.env.PATH
  try {
    process.env.PATH = binDir + delimiter + oldPath
    throws(() => updateDb(), /Command failed/)
  } finally {
    process.env.PATH = oldPath
  }
})

test.run()
