import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_ICONS, GLYPHS, ICON_ALIASES, resolveIcon, type Glyph } from './glyphs';

const root = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') ? [path] : [];
  });
}

/** Quoted kebab-case names inside `icon=…`, `source=…` and `icon: '…'` expressions. */
function iconNamesIn(text: string): string[] {
  const names: string[] = [];
  const expressions = text.match(/(?:icon|source)=\{[^}]*\}|(?:icon|source)="[^"]+"|icon: '[^']+'/g) ?? [];
  for (const expression of expressions) {
    // Ternary conditions compare theme modes ('light', 'system'); those are not icon names.
    const withoutComparisons = expression.replace(/===\s*'[^']*'/g, '');
    for (const match of withoutComparisons.matchAll(/['"]([a-z][a-z0-9-]*)['"]/g)) names.push(match[1]!);
  }
  return names;
}

describe('PayTsek icon set', () => {
  it('draws every icon name the app uses with a PayTsek glyph', () => {
    const files = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'src'))];
    const missing = new Set<string>();
    for (const file of files) {
      for (const name of iconNamesIn(readFileSync(file, 'utf8'))) {
        if (!resolveIcon(name) && !BRAND_ICONS.has(name)) missing.add(name);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });

  it('only aliases to glyphs that exist', () => {
    for (const [name, alias] of Object.entries(ICON_ALIASES)) {
      expect(Object.hasOwn(GLYPHS, alias.glyph), name).toBe(true);
    }
  });

  it('keeps tinted variants paired with a tint shape', () => {
    for (const [name, alias] of Object.entries(ICON_ALIASES)) {
      if (alias.tinted) expect((GLYPHS[alias.glyph] as Glyph).tint?.length ?? 0, name).toBeGreaterThan(0);
    }
  });

  it('keeps every path inside the 24-unit grid and well formed', () => {
    for (const [name, glyph] of Object.entries(GLYPHS)) {
      const paths = [...glyph.d, ...('tint' in glyph ? glyph.tint : []), ...('solid' in glyph ? glyph.solid : [])];
      expect(paths.length + ('circles' in glyph ? glyph.circles.length : 0), name).toBeGreaterThan(0);
      for (const d of paths) {
        expect(d, name).toMatch(/^M/);
        expect(d, name).toMatch(/^[MmLlHhVvAaCcSsQqZz0-9.,\s-]+$/);
        // Absolute moveto coordinates must sit on the canvas.
        for (const move of d.matchAll(/M(-?[\d.]+)[ ,](-?[\d.]+)/g)) {
          const x = Number(move[1]);
          const y = Number(move[2]);
          expect(x >= 0 && x <= 24 && y >= 0 && y <= 24, `${name}: ${d}`).toBe(true);
        }
      }
    }
  });
});
