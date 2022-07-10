import * as G from "galore";
import * as TLEX from "tlex";
import { DAG, Expr, Value } from "./core";

/**
 * Our parser based on our own galore parser generator!
 */
const [parser, itemGraph] = G.newParser(
  String.raw`
    %define IdentChar     /[^%!@&\^|\[\]={}()*\/<>+\-,;~: \t\f\r\n\v\\\.]/

    %token  OPEN_PAREN    "("
    %token  CLOSE_PAREN   ")"
    %token  COMMA         ","

    %token  MULTI_LINE_RAW_STRING        /r(#{0,})"/  { toMultiLineRawString }
    %token  NUMBER        /-?\d+(\.(\d+)?)?/        { toNumber }
    %token  BOOLEAN       /true|false/              { toBoolean }
    %token  STRING        /"([^"\\\n]|\\.|\\\n)*"/  { toString }
    %token  STRING        /'([^'\\\n]|\\.|\\\n)*'/  { toString }
    %token  OP            /[-=\/+!*%<>&|^?~]+/
    %token  IDENT         /{IdentChar}+/
    %skip                 /[ \t\n\f\r]+/
    %skip_flex            "//.*$"
    %skip                 /\/\*.*?\*\//


    Expr -> Expr OPList Term { concatOpExprList }
          | OPList Term      { newOpExprList }
          | Term             { newOpExprList }
          ;

    OPList -> OPList OP { concatOpList }
          | OP { newOpList }
          ;

    Term -> Literal
          | IDENT     { newVarRef }
          | OPEN_PAREN Expr CLOSE_PAREN { $2 }
          | IDENT ParenExpr { newFuncCall }
          | IDENT OPEN_PAREN CLOSE_PAREN  { newEmptyFuncCall }
          ;

    ParenExpr ->  OPEN_PAREN ExprCommaList CLOSE_PAREN { $2 } ;

    ExprCommaList -> ExprCommaList COMMA Expr { concatCommaExprList }
                  | Expr { newCommaExprList }
                  ;

    Literal -> STRING | MULTI_LINE_RAW_STRING | NUMBER | BOOLEAN ;
    `,
  {
    allowLeftRecursion: true,
    debug: "",
    type: "lalr",
    tokenHandlers: {
      toBoolean: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = owner.dag.newBool(token.value == "true");
        return token;
      },
      toNumber: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        const num = token.value.indexOf(".") >= 0 ? parseFloat(token.value) : parseInt(token.value);
        token.value = owner.dag.newNum(num);
        return token;
      },
      toString: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = owner.dag.newStr(token.value.substring(1, token.value.length - 1));
        return token;
      },
      toMultiLineRawString: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        // consume everything until "#<N times> as start
        const hashes = tape.substring(token.positions[1][0], token.positions[1][1]);
        const endPat = '"' + hashes;
        const startPos = tape.index;
        const endPos = TLEX.TapeHelper.advanceAfter(tape, endPat) - endPat.length;
        if (endPos < 0) {
          throw new Error("EOF expected while finding end of Raw String Literal: '" + endPat + "'");
        }
        token.value = owner.dag.newStr(tape.substring(startPos, endPos));
        return token;
      },
    },
  },
);

/**
 * An expression that is just a compound expression of the form
 * a OP1 b OP2 c OP3 d ... OPn N
 */
export class OpExpr {
  _finalExpr: Expr | null = null;
  isOP: boolean[] = [];
  children: (string | Expr)[] = [];

  push(...op_or_expr: (string | Expr)[]): this {
    for (const op of op_or_expr) {
      this.children.push(op);
      this.isOP.push(typeof op === "string");
    }
    return this;
  }
}

export class Operator {
  static readonly LEFT = -1;
  static readonly NOASSOC = 0;
  static readonly RIGHT = 1;

  /**
   * Operator being described.
   * Binding power of the operator.
   * Associativity - left = -1, none = 0, right = 1
   * If operator can be prefix then prefixBP specifies the BP
   * as a prefix operator.  Prefix operators only are right associative.
   */
  constructor(public op: string, public bp: number, public assoc = Operator.LEFT, public prefixBP: number = -1) {}
}

export class Parser {
  errors: TLEX.TokenizerError[] = [];
  protected ruleHandlers = {
    newOpExprList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const out = new OpExpr();
      let term: OpExpr | Expr;
      if (children.length == 1) {
        term = children[0].value;
      } else {
        const oplist: string[] = children[0].value;
        term = children[1].value;
        out.push(...oplist);
      }
      out.push(this.ensureExpr(term));
      return out;
    },
    concatOpExprList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lhsExpr: OpExpr = children[0].value;
      const oplist: string[] = children[1].value;
      const rhsTerm: OpExpr | Expr = children[2].value;
      lhsExpr.push(...oplist);
      lhsExpr.push(this.ensureExpr(rhsTerm));
      return lhsExpr;
    },
    newOpList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return [children[0].value];
    },
    concatOpList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lhsExprs: string[] = children[0].value;
      const rhsExpr: string = children[1].value;
      lhsExprs.push(rhsExpr);
      return lhsExprs;
    },
    newVarRef: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return this.dag.newVarRef(children[0].value);
    },
    unaryFuncCall: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      let v = children[1].value;
      if (!Array.isArray(v)) v = [v];
      return this.dag.newFunc(children[0].value, v);
    },
    newFuncCall: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return this.dag.newFunc(children[0].value, children[1].value);
    },
    newEmptyFuncCall: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return this.dag.newFunc(children[0].value, []);
    },
    newCommaExprList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      // return an expr as a list
      const expr: Expr | OpExpr = children[0].value;
      return [this.ensureExpr(expr)];
    },
    concatCommaExprList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lhsExprs: Expr[] = children[0].value;
      const rhsExpr: Expr | OpExpr = children[2].value;
      lhsExprs.push(this.ensureExpr(rhsExpr));
      return lhsExprs;
    },
  };

  constructor(public dag: DAG) {}

  parse(input: string): Expr {
    this.errors = [];
    const ptree = parser.parse(input, {
      tokenizerContext: this,
      ruleHandlers: this.ruleHandlers,
      onTokenError: (err: TLEX.TokenizerError) => {
        this.errors.push(err);
        return true;
      },
    });
    return this.ensureExpr(ptree?.value);
  }

  opinfos = new Map<string, Operator>();
  setOP(op: Operator): this {
    this.opinfos.set(op.op, op);
    return this;
  }

  ensureExpr(ex: OpExpr | Expr): Expr {
    if (ex.constructor.name != "OpExpr") {
      return ex as Expr;
    }

    // index of the current token
    let i = 0;
    const opex = ex as OpExpr;
    const children = opex.children;
    const isOP = opex.isOP;
    const opinfos = this.opinfos;
    const dag = this.dag;
    function hasMore(): boolean {
      return i < children.length;
    }
    function peek(): number {
      return i;
    }
    function next(): number {
      if (!hasMore()) throw new Error("No more tokens");
      return i++;
    }
    function getOp(op: string): Operator {
      const opinfo = opinfos.get(op) || null;
      if (opinfo == null) {
        throw new Error("Invalid operator: " + op);
      }
      return opinfo;
    }
    function bpof(index: number): number {
      if (!isOP[index]) {
        throw new Error("Item at index is not an operator: " + index);
      }
      const op = getOp(children[index] as string);
      return op.bp;
    }
    function nud(index: number): Expr {
      if (!isOP[index]) {
        return children[index] as Expr;
      }
      const op = getOp(children[index] as string);
      if (op.prefixBP < 0) {
        throw new Error(`(${op}) is not be a prefix operator`);
      }
      return dag.newFunc(op.op, [parse(op.prefixBP)]);
    }
    function led(index: number, left: Expr): Expr {
      if (!isOP[index]) {
        throw new Error("Expressions cannot have an LED method");
      }
      const op = getOp(children[index] as string);
      if (op.assoc == Operator.LEFT) {
        return dag.newFunc(op.op, [left, parse(op.bp)]);
      } else if (op.assoc == Operator.RIGHT) {
        return dag.newFunc(op.op, [left, parse(op.bp - 1)]);
      } else {
        throw new Error(`OP (${op.op}) has nonassoc`);
      }
    }
    function parse(rbp = 0): Expr {
      let t = next();
      let left = nud(t);
      while (hasMore() && rbp < bpof(peek())) {
        t = next();
        left = led(t, left);
      }
      return left;
    }
    return parse();
  }
}
