import { describe, expect, it } from 'vitest';
import { EnvSchema } from './env';

describe('beta billing gate configuration', () => {
  const schema = EnvSchema.shape.BETA_MODE;
  it('defaults missing and empty values to free beta', () => {
    for (const value of [undefined, '', 'true', '1']) expect(schema.parse(value)).toBe(true);
  });
  it('requires an explicit supported opt-out and rejects typos', () => {
    for (const value of ['false', '0']) expect(schema.parse(value)).toBe(false);
    expect(schema.safeParse('tru').success).toBe(false);
  });
});
