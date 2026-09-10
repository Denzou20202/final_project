// Latin + Cyrillic (incl. Ukrainian-specific letters) only; single space or
// hyphen allowed as an internal word separator (covers "Отдел продаж",
// "IT-менеджер"). Rejects digits, leading/trailing/doubled separators.
export const LETTERS_ONLY_REGEX = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]+(?:[- ][A-Za-zА-Яа-яЁёІіЇїЄєҐґ]+)*$/;

// Uppercases only the first character; leaves the rest untouched.
export function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Fixed Ukrainian format: +380 00 000-00-00 (9 national digits, 2-3-2-2).
export const PHONE_REGEX = /^\+380 \d{2} \d{3}-\d{2}-\d{2}$/;

// Rebuilds the formatted string fresh from whatever digits are present in
// rawInput on every keystroke — this is what makes backspace "just work"
// with no special-case code.
export function formatUaPhone(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '');
  let national = digits;
  if (national.startsWith('380')) {
    national = national.slice(3); // typed/pasted "+380..." or "380..."
  } else if (national.startsWith('0')) {
    national = national.slice(1); // domestic "0XX..." trunk prefix — drop
    // immediately, not just once all 10 digits are in, so the digit groups
    // build up smoothly instead of jumping around on the last keystroke
  }
  national = national.slice(0, 9);
  if (national.length === 0) return '';
  const g1 = national.slice(0, 2);
  const g2 = national.slice(2, 5);
  const g3 = national.slice(5, 7);
  const g4 = national.slice(7, 9);
  let out = `+380 ${g1}`;
  if (g2) out += ` ${g2}`;
  if (g3) out += `-${g3}`;
  if (g4) out += `-${g4}`;
  return out;
}
