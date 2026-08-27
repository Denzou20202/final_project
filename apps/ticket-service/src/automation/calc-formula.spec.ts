import { evaluateCalcFormula, substituteFieldVariables } from './calc-formula.js';

describe('evaluateCalcFormula', () => {
  it('evaluates basic arithmetic with correct precedence', () => {
    expect(evaluateCalcFormula('2 + 3 * 4', new Map())).toBe(14);
    expect(evaluateCalcFormula('(2 + 3) * 4', new Map())).toBe(20);
    expect(evaluateCalcFormula('10 - 2 - 3', new Map())).toBe(5);
    expect(evaluateCalcFormula('2 ^ 3 ^ 2', new Map())).toBe(512); // right-associative: 2^(3^2)
  });

  it('supports modulus and unary minus', () => {
    expect(evaluateCalcFormula('10 % 3', new Map())).toBe(1);
    expect(evaluateCalcFormula('-5 + 3', new Map())).toBe(-2);
    expect(evaluateCalcFormula('-(2 + 3)', new Map())).toBe(-5);
  });

  it('supports built-in functions', () => {
    expect(evaluateCalcFormula('round(2.6)', new Map())).toBe(3);
    expect(evaluateCalcFormula('floor(2.9)', new Map())).toBe(2);
    expect(evaluateCalcFormula('ceil(2.1)', new Map())).toBe(3);
    expect(evaluateCalcFormula('abs(-7)', new Map())).toBe(7);
    expect(evaluateCalcFormula('min(3, 1, 2)', new Map())).toBe(1);
    expect(evaluateCalcFormula('max(3, 1, 2)', new Map())).toBe(3);
  });

  it('substitutes {field:<uuid>} tokens with resolved variable values', () => {
    const values = new Map([['11111111-1111-1111-1111-111111111111', 7]]);
    expect(evaluateCalcFormula('{field:11111111-1111-1111-1111-111111111111} * 2', values)).toBe(14);
  });

  it('defaults an unresolved field token to 0', () => {
    const values = new Map<string, number>();
    expect(evaluateCalcFormula('{field:11111111-1111-1111-1111-111111111111} + 5', values)).toBe(5);
  });

  it('rejects division by zero instead of returning Infinity', () => {
    expect(() => evaluateCalcFormula('1 / 0', new Map())).toThrow();
    expect(() => evaluateCalcFormula('1 % 0', new Map())).toThrow();
  });

  it('rejects malformed expressions instead of silently coercing them', () => {
    expect(() => evaluateCalcFormula('2 +', new Map())).toThrow();
    expect(() => evaluateCalcFormula('(2 + 3', new Map())).toThrow();
    expect(() => evaluateCalcFormula('2 3', new Map())).toThrow();
  });

  it('rejects unknown identifiers/functions — cannot be used to reach arbitrary JS', () => {
    expect(() => evaluateCalcFormula('process.exit()', new Map())).toThrow();
    expect(() => evaluateCalcFormula('constructor("return 1")()', new Map())).toThrow();
    expect(() => evaluateCalcFormula('unknownFn(1)', new Map())).toThrow();
  });

  it('rejects formulas over the length limit', () => {
    const huge = '1+'.repeat(300) + '1';
    expect(() => evaluateCalcFormula(huge, new Map())).toThrow();
  });

  // Regression test: FUNCTIONS used to be a plain {} literal, so a formula
  // naming an inherited Object.prototype method (constructor/toString/
  // valueOf/hasOwnProperty/...) resolved through the lookup as if it were a
  // real function and got called with `this` unbound — e.g.
  // hasOwnProperty(1) threw a raw "Cannot convert undefined or null to
  // object" TypeError instead of this file's own clean, admin-facing
  // "Unknown function" message. No exploit resulted (nothing here reaches
  // arbitrary JS), just a confusing error.
  it('rejects a formula naming an inherited Object.prototype method the same as any other unknown function', () => {
    expect(() => evaluateCalcFormula('hasOwnProperty(1)', new Map())).toThrow(/Unknown function/);
    expect(() => evaluateCalcFormula('valueOf(1)', new Map())).toThrow(/Unknown function/);
    expect(() => evaluateCalcFormula('toString(1)', new Map())).toThrow(/Unknown function/);
  });
});

describe('substituteFieldVariables', () => {
  it('only matches well-formed uuid tokens, not arbitrary braces', () => {
    const values = new Map([['11111111-1111-1111-1111-111111111111', 42]]);
    expect(substituteFieldVariables('{field:11111111-1111-1111-1111-111111111111}', values)).toBe('42');
    expect(substituteFieldVariables('{notafield}', values)).toBe('{notafield}');
  });
});
