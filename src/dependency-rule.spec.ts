import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IMPORT_SOURCE = /from\s+'([^']+)'/g;

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(join(__dirname, dir));
  const files: string[] = [];
  for (const entry of entries) {
    const relative = join(dir, entry);
    const absolute = join(__dirname, relative);
    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFiles(relative));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(relative);
    }
  }
  return files;
}

function externalImports(relativePath: string): string[] {
  const content = readFileSync(join(__dirname, relativePath), 'utf8');
  const sources: string[] = [];
  for (const match of content.matchAll(IMPORT_SOURCE)) {
    const source = match[1];
    if (!source.startsWith('.')) {
      sources.push(source);
    }
  }
  return sources;
}

describe('dependency rule', () => {
  it('keeps the domain free of any external dependency', () => {
    const offenders = sourceFiles('domain')
      .map((file) => ({ file, imports: externalImports(file) }))
      .filter((entry) => entry.imports.length > 0);

    expect(offenders).toEqual([]);
  });

  it('limits the application layer to DI decorators and node builtins', () => {
    const allowed = new Set(['@nestjs/common']);
    const offenders = sourceFiles('application')
      .map((file) => ({
        file,
        imports: externalImports(file).filter(
          (source) => !allowed.has(source) && !source.startsWith('node:'),
        ),
      }))
      .filter((entry) => entry.imports.length > 0);

    expect(offenders).toEqual([]);
  });

  it('keeps the domain unaware of the layers that depend on it', () => {
    const offenders = sourceFiles('domain')
      .map((file) => ({
        file,
        imports: readFileSync(join(__dirname, file), 'utf8')
          .split('\n')
          .filter(
            (line) =>
              line.includes('infrastructure') ||
              line.includes('presentation') ||
              line.includes('application'),
          ),
      }))
      .filter((entry) => entry.imports.length > 0);

    expect(offenders).toEqual([]);
  });
});
