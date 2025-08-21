import { resolve as importMetaResolve } from 'import-meta-resolve';
import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import stringArgv from 'string-argv';
import validateNpmPackageName from 'validate-npm-package-name';
import type { Context } from 'node:vm';
import type { REPLServer } from 'node:repl';

type Package = {
  install: string;
  scope: string;
  name: string;
  version: string;
  subpath: string;
};

type PackageToInstall = Package & {
  spec: string;
  alias: string;
}

type InstalledPackage = PackageToInstall & {
  uuid: string;
  installedPath: string;
}

const execAsync = promisify(exec);
const packageSpecPattern = /^(?<install>(?<scope>@[^\/]+\/)?(?<name>[^\/@]+)(?<version>@[^\/]+)?)(?<subpath>\/.+)?$/;

export function parsePackageSpec (spec: string):Package {
  const match = spec.match(packageSpecPattern);
  const install = match?.groups?.install || '';
  const scope = match?.groups?.scope || '';
  const name = match?.groups?.name || '';
  const version = match?.groups?.version || '';
  const subpath = match?.groups?.subpath || '';
  return { install, scope, name, version, subpath };
}

export function getPackagesToInstallFromArgv (argv:string[]):PackageToInstall[] {
  return argv.map(arg => {
    // `arg` can be formatted as 'moment' or 'momentjs=moment' or 'momentjs=moment@1.0.1'
    // This allows users to provided aliases, in order to support multiple versions of the same module
    const hasAlias = arg.includes('=');
    const spec = hasAlias ? arg.split('=')[1] : arg;
    const parsedSpec = parsePackageSpec(spec);

    return {
      spec,
      alias: hasAlias ? arg.split('=')[0] : parsedSpec.name,
      ...parsedSpec,
    };
  });
}

export async function installPackage (packageToInstall: PackageToInstall, installPath: string): Promise<InstalledPackage> {
  const uuid = randomUUID();
  const { install, alias } = packageToInstall;
  try {
    await execAsync(`npm install -g ${uuid}@npm:${install} --prefix ${installPath}`);
    console.log(`✅ Installed ${install} as ${alias}`);
    const installedPath = join(installPath, 'lib', 'node_modules', uuid);
    return { ...packageToInstall, uuid, installedPath };
  } catch (err: any) {
    throw new Error(`❌ Failed to install ${install}:\n`, { cause: err });
  }
}

export async function installPackages (packagesToInstall: PackageToInstall[], installPath: string): Promise<InstalledPackage[]> {
  console.log('💾 Downloading packages...');
  return Promise.all(packagesToInstall.map(pkg => installPackage(pkg, installPath)));
}

export async function importPackageIntoContext (context: Context, installedPackage: InstalledPackage) {
  const { alias, uuid, installedPath, subpath } = installedPackage;
  const nodeModulesPath = 'file://' + resolve(installedPath, '..');
  const resolvedPath = await importMetaResolve(uuid + subpath, nodeModulesPath);
  const pkg = await import(resolvedPath.toString());

  // For convenience, auto assign the default export if it's the only export
  const onlyHasDefaultExport = Object.keys(pkg).length === 1 && pkg['default'];
  // Use Object.defineProperty to avoid the ugly 'Expression assignment to _ now disabled.' message
  Object.defineProperty(context, alias, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: onlyHasDefaultExport ? pkg['default'] : pkg,
  });
}

export async function importPackagesIntoContext (context: Context, packages: InstalledPackage[]) {
  for (const pkg of packages) {
    await importPackageIntoContext(context, pkg);
  }
}

const JS_RESERVED_WORDS:readonly string[] = [
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import',
  'in', 'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
];
export function isValidJsVariableName (name: string): boolean {
  if (JS_RESERVED_WORDS.includes(name)) {
    return false;
  }
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

export function validatePackageNames (newPackages: PackageToInstall[], alreadyInstalled: InstalledPackage[] = []):void {
  newPackages.forEach(pkg => {
    if (!isValidJsVariableName(pkg.alias)) {
      throw new Error(`Invalid alias: ${pkg.alias}. Aliases must be valid JavaScript variable names.`);
    }
    const packageName = pkg.scope + pkg.name;
    if (validateNpmPackageName(packageName).errors?.length) {
      throw new Error(`Invalid package name: ${packageName}. Names must be valid npm package names: https://www.npmjs.com/package/validate-npm-package-name#naming-rules`);
    }
  });

  const allAliases = [...newPackages, ...alreadyInstalled].map(pkg => pkg.alias);
  const uniqueAliases = new Set(allAliases);
  if (allAliases.length !== uniqueAliases.size) {
    throw new Error('Package names must be unique, or use unique aliases (e.g. "l=lodash") to import multiple versions of the same package.');
  }
}

export async function createInstallationDirectory () {
  const path = join(tmpdir(), 'repl-with-');
  try {
    return await mkdtemp(path);
  } catch (err: any) {
    throw new Error(`Failed to create installation directory: ${path}\n`, { cause: err });
  }
}

export function showReplHeader (packages: InstalledPackage[]) {
  console.log('');
  console.log(`Welcome to Node.js ${process.version}.`);
  console.log(`Type ".help" for more information.`);
  listPackages(packages);
}

export async function importAdditionalPackagesViaCommand ({
  args,
  replServer,
  installedPackages,
  installPath,
}: {
  args: string;
  replServer: REPLServer;
  installedPackages: InstalledPackage[];
  installPath: string;
}) {
  try {
    // Parse arguments
    const argv = stringArgv(args);
    const newPackages = getPackagesToInstallFromArgv(argv);
    validatePackageNames(newPackages, installedPackages);

    // Install packages
    const newlyInstalledPackages = await installPackages(newPackages, installPath);
    installedPackages.push(...newlyInstalledPackages);

    // Import packages into context
    await importPackagesIntoContext(replServer.context, newlyInstalledPackages);
    listPackages(installedPackages, replServer);

  } catch (err: any) {
    console.error(err.message);
  } finally {
    replServer.displayPrompt();
  }
}

export function setupReplServer (replServer: REPLServer, {
  installPath,
  installedPackages,
}: {
  installPath: string;
  installedPackages: InstalledPackage[];
}) {
  replServer.context.r = replServer;
  replServer.defineCommand('packages', {
    help: 'List available packages',
    action: () => listPackages(installedPackages, replServer),
  });
  replServer.defineCommand('import', {
    help: 'Import additional NPM packages',
    action: (args) => importAdditionalPackagesViaCommand({
      args,
      replServer,
      installedPackages,
      installPath,
    }),
  });
  replServer.defineCommand('debug', {
    help: 'Show debugging info',
    action: () => {
      console.log(installedPackages);
      replServer.displayPrompt();
    },
  });
  replServer.on('reset', (context) => {
    importPackagesIntoContext(replServer.context, installedPackages);
  });
  replServer.on('exit', async() => {
    console.log('🚪 Exiting...');
    await cleanup(installPath);
    process.exit(0);
  });
}

export function listPackages (packages: InstalledPackage[], replServer?: REPLServer) {
  console.log('');
  console.log('📦 Available packages:');
  packages.forEach(pkg => {
    console.log(`- ${pkg.alias} = ${pkg.install}`);
  });
  console.log('');
  if (replServer) {
    replServer.displayPrompt();
  }
}

export async function cleanup (path: string) {
  console.log('🧹 Cleaning up installed packages...');
  await rm(path, { recursive: true, force: true });
  console.log('✅ All packages removed');
}
