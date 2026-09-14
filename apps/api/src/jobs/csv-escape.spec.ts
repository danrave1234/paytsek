import { describe, expect, it } from 'vitest';
import { csvEscape } from './worker.service';

describe('csvEscape — spreadsheet formula injection', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('GCash')).toBe('GCash');
    expect(csvEscape('1250.00')).toBe('1250.00');
    expect(csvEscape('')).toBe('');
  });

  it('quotes values containing separators or quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
  });

  it('neutralizes cells starting with =, +, -, @, tab, or CR', () => {
    expect(csvEscape('=1+2')).toBe("'=1+2");
    expect(csvEscape('+63 900')).toBe("'+63 900");
    expect(csvEscape('-cmd')).toBe("'-cmd");
    expect(csvEscape('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvEscape('\t=1')).toBe("'\t=1");
    expect(csvEscape('\r=1')).toBe(`"'\r=1"`);
  });

  it('neutralizes and quotes a formula containing a comma', () => {
    expect(csvEscape('=HYPERLINK("http://x",1)')).toBe(`"'=HYPERLINK(""http://x"",1)"`);
  });
});
