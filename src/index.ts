#!/usr/bin/env node

import * as repl from 'node:repl';
import {
  getPackagesToInstallFromArgv,
  validatePackageNames,
  createInstallationDirectory,
  installPackages,
  importPackagesIntoContext,
  showReplHeader,
  setupReplServer,
  cleanup,
} from './lib.js';

(async function main() {
  const installPath = await createInstallationDirectory();

  try {
    // Get the arguments after the script name
    const packagesInArgv = process.argv.slice(2);
    const packagesToImport = getPackagesToInstallFromArgv(packagesInArgv);
    validatePackageNames(packagesToImport, []);

    // Install packages
    const installedPackages = await installPackages(packagesToImport, installPath);

    // Create and setup REPL server
    showReplHeader(installedPackages);
    const replServer = repl.start({
      prompt: '> ',
      useColors: true,
    });
    setupReplServer(replServer, {
      installPath,
      installedPackages,
    });

    // Import packages into context
    await importPackagesIntoContext(replServer.context, installedPackages);

    // Ready to go!
    replServer.displayPrompt();

  } catch (err) {
    console.error('❌ Error:', err);
    await cleanup(installPath);
    throw err;
  }
})();
