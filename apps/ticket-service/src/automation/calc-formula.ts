// A tiny, safe arithmetic-expression evaluator for the SET_CUSTOM_FIELD
// action's `formula` — deliberately NOT eval()/new Function() (formulas are
// admin-authored but still untrusted input from an HTTP body; a real parser
// can't escape into arbitrary JS no matter what string is fed to it).
//
// Grammar: expr := term (('+'|'-') term)*
//          term := power (('*'|'/'|'%') power)*
//          power := unary ('^' unary)*
//          unary := '-' unary | primary
//          primary := NUMBER | '(' expr ')' | NAME '(' expr (',' expr)* ')'
const MAX_FORMULA_LENGTH = 500;

// Object.create(null) — a plain {} literal's inherited Object.prototype
// names (constructor/toString/valueOf/hasOwnProperty/...) would otherwise
// resolve through FUNCTIONS[name] as if they were real formula functions
// (a formula like "hasOwnProperty(1)" calling Object.prototype.hasOwnProperty
// with `this` unbound). No exploit results (the caller's Number.isFinite
// check or try/catch always catches the fallout), but it's a confusing raw
// JS error instead of this file's own clean "Unknown function" message. No
// prototype chain at all means every lookup is a real own-property check.
const FUNCTIONS: Record<string, ((...args: number[]) => number) | undefined> = Object.assign(Object.create(null), {
  round: (x: number) => Math.round(x),
  floor: (x: number) => Math.floor(x),
  ceil: (x: number) => Math.ceil(x),
  abs: (x: number) => Math.abs(x),
  min: (...xs: number[]) => Math.min(...xs),
  max: (...xs: number[]) => Math.max(...xs),
});

// Matches the exact token shape produced by callers that embed a custom
// field's value into a formula — anchored so it can never match a partial
// UUID or leak into an unrelated brace-delimited substring.
const FIELD_TOKEN = /\{field:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}/gi;

export function substituteFieldVariables(formula: string, values: Map<string, number>): string {
  return formula.replace(FIELD_TOKEN, (_match, fieldId: string) => String(values.get(fieldId) ?? 0));
}

class CalcSyntaxError extends Error {}

class Parser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseExpr();
    this.skipSpace();
    if (this.pos < this.input.length) {
      throw new CalcSyntaxError(`Unexpected character at position ${this.pos}`);
    }
    return value;
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    for (;;) {
      this.skipSpace();
      const op = this.peek();
      if (op === '+' || op === '-') {
        this.pos++;
        const rhs = this.parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  private parseTerm(): number {
    let value = this.parsePower();
    for (;;) {
      this.skipSpace();
      const op = this.peek();
      if (op === '*' || op === '/' || op === '%') {
        this.pos++;
        const rhs = this.parsePower();
        if ((op === '/' || op === '%') && rhs === 0) {
          throw new CalcSyntaxError('Division by zero');
        }
        value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
      } else {
        return value;
      }
    }
  }

  private parsePower(): number {
    const base = this.parseUnary();
    this.skipSpace();
    if (this.peek() === '^') {
      this.pos++;
      const exponent = this.parsePower(); // right-associative
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parseUnary(): number {
    this.skipSpace();
    if (this.peek() === '-') {
      this.pos++;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipSpace();
    const ch = this.peek();

    if (ch === '(') {
      this.pos++;
      const value = this.parseExpr();
      this.skipSpace();
      if (this.peek() !== ')') throw new CalcSyntaxError('Expected ")"');
      this.pos++;
      return value;
    }

    if (ch !== undefined && /[a-zA-Z]/.test(ch)) {
      const name = this.readWhile(/[a-zA-Z0-9_]/);
      this.skipSpace();
      if (this.peek() !== '(') {
        throw new CalcSyntaxError(`Unknown identifier "${name}"`);
      }
      const fn = FUNCTIONS[name];
      if (!fn) {
        throw new CalcSyntaxError(`Unknown function "${name}"`);
      }
      this.pos++; // consume '('
      const args: number[] = [this.parseExpr()];
      this.skipSpace();
      while (this.peek() === ',') {
        this.pos++;
        args.push(this.parseExpr());
        this.skipSpace();
      }
      if (this.peek() !== ')') throw new CalcSyntaxError('Expected ")"');
      this.pos++;
      return fn(...args);
    }

    if (ch !== undefined && (/[0-9]/.test(ch) || ch === '.')) {
      const numStr = this.readWhile(/[0-9.]/);
      const value = Number(numStr);
      if (Number.isNaN(value)) throw new CalcSyntaxError(`Invalid number "${numStr}"`);
      return value;
    }

    throw new CalcSyntaxError(`Unexpected character "${ch ?? '<end>'}" at position ${this.pos}`);
  }

  private peek(): string | undefined {
    return this.input[this.pos];
  }

  private skipSpace(): void {
    while (this.input[this.pos] === ' ' || this.input[this.pos] === '\t') this.pos++;
  }

  private readWhile(pattern: RegExp): string {
    const start = this.pos;
    while (this.pos < this.input.length && pattern.test(this.input[this.pos])) this.pos++;
    return this.input.slice(start, this.pos);
  }
}

export function evaluateCalcFormula(formula: string, variables: Map<string, number>): number {
  if (formula.length > MAX_FORMULA_LENGTH) {
    throw new CalcSyntaxError(`Formula exceeds ${MAX_FORMULA_LENGTH} characters`);
  }
  const substituted = substituteFieldVariables(formula, variables);
  const result = new Parser(substituted).parse();
  if (!Number.isFinite(result)) {
    throw new CalcSyntaxError('Formula did not evaluate to a finite number');
  }
  return result;
}
