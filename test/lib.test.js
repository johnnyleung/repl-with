import stringArgv from 'string-argv';
import { describe,test, expect } from 'vitest';
import { stat } from 'node:fs/promises';
import {
  parsePackageSpec,
  getPackagesToInstallFromArgv,
  validatePackageNames,
  createInstallationDirectory,
  cleanup,
} from '../src/lib.js';

describe('parsePackageSpec', () => {
  test('should parse package spec correctly', () => {
    expect(parsePackageSpec('module')).toEqual({
      install: 'module',
      name: 'module',
      scope: '',
      version: '',
      subpath: '',
    });
    expect(parsePackageSpec('module@4.0.0')).toEqual({
      install: 'module@4.0.0',
      name: 'module',
      scope: '',
      version: '@4.0.0',
      subpath: '',
    });
    expect(parsePackageSpec('module@4.0.0/subpath')).toEqual({
      install: 'module@4.0.0',
      name: 'module',
      scope: '',
      version: '@4.0.0',
      subpath: '/subpath',
    });
    expect(parsePackageSpec('@org/module')).toEqual({
      install: '@org/module',
      name: 'module',
      scope: '@org/',
      version: '',
      subpath: '',
    });
    expect(parsePackageSpec('@org/module@4.0.0')).toEqual({
      install: '@org/module@4.0.0',
      name: 'module',
      scope: '@org/',
      version: '@4.0.0',
      subpath: '',
    });
    expect(parsePackageSpec('@org/module@4.0.0/subpath')).toEqual({
      install: '@org/module@4.0.0',
      name: 'module',
      scope: '@org/',
      version: '@4.0.0',
      subpath: '/subpath',
    });
  });
});

describe('getPackagesToInstallFromArgv', () => {
  test('should parse arguments correctly', () => {
    const argv = stringArgv(
      'module module/subpath m=module@2.0 @org/module @org/module@v1.0.0 _=@org/module@^1.2.3/subpath'
    );
    const expected = [
      // module
      {
        spec: 'module',
        alias: 'module',
        install: 'module',
        name: 'module',
        scope: '',
        subpath: '',
        version: '',
      },
      // module/subpath
      {
        spec: 'module/subpath',
        alias: 'module',
        install: 'module',
        name: 'module',
        scope: '',
        subpath: '/subpath',
        version: '',
      },
      // m=module@2.0
      {
        spec: 'module@2.0',
        alias: 'm',
        install: 'module@2.0',
        name: 'module',
        scope: '',
        subpath: '',
        version: '@2.0',
      },
      // @org/module
      {
        spec: '@org/module',
        alias: 'module',
        install: '@org/module',
        name: 'module',
        scope: '@org/',
        subpath: '',
        version: '',
      },
      // @org/module@v1.0.0
      {
        spec: '@org/module@v1.0.0',
        alias: 'module',
        install: '@org/module@v1.0.0',
        name: 'module',
        scope: '@org/',
        subpath: '',
        version: '@v1.0.0',
      },
      // @org/module@^1.2.3/subpath
      {
        spec: '@org/module@^1.2.3/subpath',
        alias: '_',
        install: '@org/module@^1.2.3',
        name: 'module',
        scope: '@org/',
        subpath: '/subpath',
        version: '@^1.2.3',
      },
    ];
    expect(getPackagesToInstallFromArgv(argv)).toEqual(expected);
  });
});

describe('validatePackageNames', () => {
  test('should throw if aliases are not unique', () => {
    const packages = getPackagesToInstallFromArgv([
      'lodash@3.0.0',
      'lodash@4.0.0',
    ]);
    expect(() => validatePackageNames(packages)).toThrowError();
  });
  test('should not throw if aliases are unique', () => {
    const packages = getPackagesToInstallFromArgv([
      'l1=lodash@3.0.0',
      'l2=lodash@3.0.0',
    ]);
    expect(() => validatePackageNames(packages)).not.toThrowError();
  });
});

describe('setup and cleanup', () => {
  test('should create installation directory and clean it up successfully', async () => {
    // Create installation directory
    const installPath = await createInstallationDirectory();

    // Verify directory was created and has expected format
    const stats = await stat(installPath);
    expect(stats.isDirectory()).toBe(true);

    // Clean up the directory
    await cleanup(installPath);

    // Verify directory was removed
    await expect(() => stat(installPath)).rejects.toThrowError();
  });
});
