// Shared by CompleteProfileDto / UpdateOwnProfileDto / UpdateUserProfileDto.
// Mirrors the frontend's textValidation.ts exactly (same shape, defense in
// depth) — Latin + Cyrillic (incl. Ukrainian-specific letters) only, single
// space/hyphen as internal word separators.
export const LETTERS_ONLY_PATTERN = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]+(?:[- ][A-Za-zА-Яа-яЁёІіЇїЄєҐґ]+)*$/;

export const PHONE_PATTERN = /^\+380 \d{2} \d{3}-\d{2}-\d{2}$/;

// Optional-field variants: @IsOptional() only skips remaining validators
// when the value is null/undefined, NOT '' — UsersService coerces an
// explicit '' to null ("clear the field"), so any optional
// position/department/phone @Matches must also accept ''.
export const LETTERS_ONLY_OR_EMPTY_PATTERN = /^$|^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]+(?:[- ][A-Za-zА-Яа-яЁёІіЇїЄєҐґ]+)*$/;
export const PHONE_OR_EMPTY_PATTERN = /^$|^\+380 \d{2} \d{3}-\d{2}-\d{2}$/;
