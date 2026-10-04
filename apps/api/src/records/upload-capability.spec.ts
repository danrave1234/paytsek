import { describe, expect, it, vi } from 'vitest';
import { uploadTokenExpiresAt } from './upload-capability';

const syntheticToken=(payload:object)=>`synthetic.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.not-a-signature`;
describe('trusted provider upload expiry metadata',()=>{
  it('returns the provider expiry rather than a configured five-minute estimate',()=>{
    vi.spyOn(Date,'now').mockReturnValue(1_800_000_000_000);
    try {expect(uploadTokenExpiresAt(syntheticToken({exp:1_800_007_200})).toISOString()).toBe(new Date(1_800_007_200_000).toISOString());}
    finally {vi.restoreAllMocks();}
  });
  it('refuses missing, invalid, or already expired capability metadata',()=>{
    for(const token of ['bad',syntheticToken({}),syntheticToken({exp:'2000000000'}),syntheticToken({exp:1})]) {
      expect(()=>uploadTokenExpiresAt(token)).toThrow('UPLOAD_CAPABILITY_EXPIRY_INVALID');
    }
  });
});
