/**
 * 四則演算パーサ (eval 不使用)
 * 対応: + - * / 括弧 変数 数値 単項マイナス
 */

function tokenize(formula) {
  const tokens = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) num += formula[i++];
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
    } else if (/[a-zA-Z_\u3040-\u9FFF]/.test(ch)) {
      // 変数名 (ASCII英字・アンダースコア・ひらがな・カタカナ・漢字を許容)
      let name = '';
      while (i < formula.length && /[a-zA-Z0-9_\u3040-\u9FFF]/.test(formula[i])) name += formula[i++];
      tokens.push({ type: 'IDENT', value: name });
    } else if ('+-*/()'.includes(ch)) {
      tokens.push({ type: ch });
      i++;
    } else {
      throw new Error(`不正な文字: "${ch}"`);
    }
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.variables = new Set();
  }

  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }

  expect(type) {
    const tok = this.consume();
    if (tok.type !== type) throw new Error(`"${type}" が必要なところ "${tok.type}" が来ました`);
    return tok;
  }

  parseExpr() { return this.parseAddSub(); }

  parseAddSub() {
    let node = this.parseMulDiv();
    while (this.peek().type === '+' || this.peek().type === '-') {
      const op = this.consume().type;
      const right = this.parseMulDiv();
      node = { type: 'BINOP', op, left: node, right };
    }
    return node;
  }

  parseMulDiv() {
    let node = this.parseUnary();
    while (this.peek().type === '*' || this.peek().type === '/') {
      const op = this.consume().type;
      const right = this.parseUnary();
      node = { type: 'BINOP', op, left: node, right };
    }
    return node;
  }

  parseUnary() {
    if (this.peek().type === '-') {
      this.consume();
      const operand = this.parsePrimary();
      return { type: 'UNARY', op: '-', operand };
    }
    if (this.peek().type === '+') {
      this.consume();
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();
    if (tok.type === 'NUMBER') {
      this.consume();
      return { type: 'NUMBER', value: tok.value };
    }
    if (tok.type === 'IDENT') {
      this.consume();
      this.variables.add(tok.value);
      return { type: 'VAR', name: tok.value };
    }
    if (tok.type === '(') {
      this.consume();
      const node = this.parseExpr();
      this.expect(')');
      return node;
    }
    throw new Error(`予期しないトークン: "${tok.type}"`);
  }
}

function evaluate(node, vars) {
  switch (node.type) {
    case 'NUMBER': return node.value;
    case 'VAR': {
      const v = vars[node.name];
      return (v === undefined || v === '' || isNaN(v)) ? null : Number(v);
    }
    case 'UNARY': {
      const v = evaluate(node.operand, vars);
      return v === null ? null : -v;
    }
    case 'BINOP': {
      const l = evaluate(node.left, vars);
      const r = evaluate(node.right, vars);
      if (l === null || r === null) return null;
      if (node.op === '/' && r === 0) throw new Error('ゼロ除算');
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
      }
    }
    default: throw new Error('不正なノード');
  }
}

/**
 * 数式をパースして AST と変数一覧を返す
 * @param {string} formula
 * @returns {{ ast: object, variables: string[] }}
 */
function parse(formula) {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens);
  const ast = parser.parseExpr();
  if (parser.peek().type !== 'EOF') {
    throw new Error('数式の末尾に余分な文字があります');
  }
  return { ast, variables: [...parser.variables] };
}

/**
 * パース済み AST に変数値を与えて計算
 * @param {object} ast
 * @param {Record<string, number|string>} vars
 * @returns {number|null} null = 未入力変数あり
 */
function calc(ast, vars) {
  return evaluate(ast, vars);
}

export { parse, calc };
