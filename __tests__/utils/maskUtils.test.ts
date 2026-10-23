import { maskEmail } from '../../src/utils/maskUtils';

describe('maskEmail', () => {
  it('should mask standard email addresses correctly', () => {
    expect(maskEmail('deyvid0932@gmail.com')).toBe('de***2@gmail.com');
    expect(maskEmail('john.doe@example.com')).toBe('jo***e@example.com');
  });

  it('should handle short local parts', () => {
    expect(maskEmail('ab@gmail.com')).toBe('a***@gmail.com');
    expect(maskEmail('a@gmail.com')).toBe('a***@gmail.com');
  });

  it('should handle null, undefined, or invalid emails gracefully', () => {
    expect(maskEmail(null)).toBe('');
    expect(maskEmail(undefined)).toBe('');
    expect(maskEmail('invalid-email')).toBe('invalid-email');
  });
});
