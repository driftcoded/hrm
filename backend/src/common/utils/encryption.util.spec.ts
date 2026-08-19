import { decryptSecret, encryptSecret } from './encryption.util';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

describe('encryptSecret / decryptSecret', () => {
  it('decrypts back to the original plaintext', () => {
    const ciphertext = encryptSecret('my-smtp-password', KEY_A);

    expect(decryptSecret(ciphertext, KEY_A)).toBe('my-smtp-password');
  });

  it('produces a different ciphertext each call (random IV), even for the same plaintext', () => {
    const first = encryptSecret('same-password', KEY_A);
    const second = encryptSecret('same-password', KEY_A);

    expect(first).not.toBe(second);
    expect(decryptSecret(first, KEY_A)).toBe('same-password');
    expect(decryptSecret(second, KEY_A)).toBe('same-password');
  });

  it('throws instead of returning corrupted plaintext when the key is wrong', () => {
    const ciphertext = encryptSecret('my-smtp-password', KEY_A);

    expect(() => decryptSecret(ciphertext, KEY_B)).toThrow();
  });

  it('throws when the ciphertext has been tampered with', () => {
    const ciphertext = encryptSecret('my-smtp-password', KEY_A);
    const raw = Buffer.from(ciphertext, 'base64');
    raw[raw.length - 1] ^= 0xff;
    const tampered = raw.toString('base64');

    expect(() => decryptSecret(tampered, KEY_A)).toThrow();
  });

  it('round-trips an empty string', () => {
    const ciphertext = encryptSecret('', KEY_A);

    expect(decryptSecret(ciphertext, KEY_A)).toBe('');
  });
});
