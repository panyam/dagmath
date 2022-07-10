export enum ExprType {
  VARREF = "VarRef",
  VALUE = "Value",
  FUNCCALL = "FuncCall",
  OPEXPR = "OpExpr",
}

export enum ValueType {
  BOOL,
  INT,
  STRING,
}

export type FuncType = (dag: DAG, args: Value[]) => Value;

/**
 * General way of denoting units.
 */
export class Units {
  public constructor(public num: string[], public den: string[]) {}
}

export class CircularReferenceError extends Error {}
export class InvalidRefError extends Error {}

/**
 * Our DAG is where all equations, variables, functions are registered and
 * evaluated as well as relationships between them are recorded and validated.
 *
 * The DAG enforces a few things:
 *
 * 1. Ensures there are no circular references.
 * 2. Allows efficiency in how instances are created (eg sharing of singletons)
 * 3. Capturing changes to values and ensuring that changes are appropriately
 *    propogated
 */
export class DAG {
  lastModified = 0;
  NULL = new Value(this, null);
  ZERO = new Value(this, 0);
  ONE = new Value(this, 1);
  TRUE = new Value(this, true);
  FALSE = new Value(this, false);

  // Stores all variables
  protected vars = new Map<string, Var>();
  protected unitsMap = new Map<string, Units>();
  protected funcs = new Map<string, FuncType>();

  /**
   * Registers units.
   */
  newUnits(num: string[], den: string[]) {
    const sortednum = [...(num || [])];
    sortednum.sort();
    const sortedden = [...(den || [])];
    sortedden.sort();
    const key = sortednum.join(":") + "/" + sortedden.join(":");
    let out = this.unitsMap.get(key) || null;
    if (out == null) {
      out = new Units(num, den);
      this.unitsMap.set(key, out);
    }
    return out;
  }

  getFunc(name: string): FuncType | null {
    return this.funcs.get(name) || null;
  }

  regFunc(name: string, f: FuncType): this {
    this.funcs.set(name, f);
    return this;
  }

  /**
   * Creates a new function in this dag.
   */
  newFunc(name: string, args: Expr[]): FuncCall {
    return new FuncCall(this, name, args);
  }

  /**
   * Creates a boolean literal in this dag.
   */
  newBool(value: boolean): Value {
    return value ? this.TRUE : this.FALSE;
  }

  /**
   * Creates a numeric literal in this dag.
   */
  newNum(value: number) {
    // TODO - worth creating signletons?
    return new Value(this, value);
  }

  /**
   * Value around a string literal.
   */
  newStr(value: string) {
    return new Value(this, value);
  }

  /**
   * Creates a new variable in this DAG.
   */
  newVar(varname: string, expr: Expr | null) {
    return this.setValue(varname, expr);
  }

  newVarRef(varname: string): VarRef {
    return new VarRef(this, varname);
  }

  /**
   * Returns the variable by the given name.
   */
  getVar(varname: string, ensure = false): Var | null {
    let out = this.vars.get(varname) || null;
    if (out == null && ensure) {
      // create an empty var
      out = new Var(this, varname, this.NULL);
      this.vars.set(varname, out);
    }
    return out;
  }

  setValue(varname: string, newValue: Expr | null): Var {
    newValue = newValue || this.NULL;
    const v = this.getVar(varname, true) as Var;
    if (this.exprContainsVar(newValue, varname)) {
      throw new CircularReferenceError("Circular reference for variable: " + varname);
    }
    if (v.value != this.NULL) {
      // remove references first
    }
    v.value = newValue;
    // TODO - propogate changes to dependants
    return v;
  }

  exprContainsVar(expr: Expr | null, varname: string): boolean {
    // TODO - we can do some speedups here
    // 1. Dont bother checking variable names already checked
    //    - useful if a variable name is referred to multiple times in an expression.
    if (expr == null || expr.type == ExprType.VALUE) return false;
    if (expr.type == ExprType.VARREF) {
      const vname = (expr as VarRef).name;
      if (vname == varname) return true;

      // if name does not match ensure that the var's expression
      // does not refer to varname
      const v = this.getVar(vname);
      return v != null && this.exprContainsVar(v.value, varname);
    }
    if (expr.type == ExprType.FUNCCALL) {
      // see it is not in any of the args
      for (const e of (expr as FuncCall).args) {
        if (this.exprContainsVar(e, varname)) {
          return true;
        }
      }
    }
    return false;
  }
}

export abstract class Expr {
  protected lastEvaluated = -1;
  private static counter = 0;
  private _latestValue: Value;
  readonly uuid = Expr.counter++;

  constructor(public dag: DAG) {
    this._latestValue = dag.ZERO;
  }

  get type(): unknown {
    return this.constructor.name;
  }

  get latestValue(): Value {
    if (this.lastEvaluated < this.dag.lastModified) {
      // an update is needed
      this._latestValue = this.eval();
      this.lastEvaluated = this.dag.lastModified;
    }
    return this._latestValue;
  }

  debugValue(): any {
    return {};
  }

  abstract eval(): Value;
}

export class Value extends Expr {
  constructor(public dag: DAG, public readonly value: any) {
    super(dag);
  }

  get latestValue(): Value {
    return this;
  }

  eval(): Value {
    return this;
  }

  debugValue(): any {
    return this.value;
  }
}

export class FuncCall extends Expr {
  // Name of the operator
  constructor(public dag: DAG, public funcname: string, public args: Expr[]) {
    super(dag);
  }

  debugValue(): any {
    return { func: this.funcname, args: this.args.map((a) => a.debugValue()) };
  }

  eval(): Value {
    const values = this.args.map((a) => a.latestValue);
    const func = this.dag.getFunc(this.funcname);
    if (func == null) {
      throw new InvalidRefError("Invalid reference: " + this.funcname);
    }
    return func(this.dag, values);
  }
}

export class Var {
  desc = "";
  constructor(public dag: DAG, public name: string, public value: Expr) {}

  get latestValue(): Value {
    return this.value.latestValue;
  }
}

/**
 * Reference to a variable by name.
 */
export class VarRef extends Expr {
  constructor(public dag: DAG, public name: string) {
    super(dag);
  }

  debugValue(): any {
    return "Var(" + this.name + ")";
  }

  eval(): Value {
    const v = this.dag.getVar(this.name);
    return v == null ? this.dag.NULL : v.latestValue;
  }
}
