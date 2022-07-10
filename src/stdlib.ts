import { DAG, Value, Expr } from "./core";

export function PopulateDAG(dag: DAG): DAG {
  dag.regFunc("+", Plus);
  dag.regFunc("*", Mult);
  dag.regFunc("/", Div);
  dag.regFunc("-", Minus);
  dag.regFunc("**", Pow);
  dag.regFunc("^", BitwiseXor);
  dag.regFunc("|", BitwiseOr);
  dag.regFunc("ceil", Ceiling);
  dag.regFunc("floor", Floor);
  dag.regFunc("round", Round);
  return dag;
}

/**
 * Returns the addition of a bunch of sub-expressions.
 */
export const Plus = (dag: DAG, args: Value[]): Value => {
  let out = 0;
  for (const v of args) {
    out += v.value;
  }
  return new Value(dag, out);
};

/**
 * Returns the multiplication of a bunch of sub-expressions.
 */
export const Mult = (dag: DAG, args: Value[]): Value => {
  let out = 1;
  for (const v of args) {
    out *= v.value;
  }
  return new Value(dag, out);
};

/**
 * Returns arg[0] - arg[1] - arg[2] ... - arg[n]
 */
export const Minus = (dag: DAG, args: Value[]): Value => {
  let out = args[0].value;
  for (let i = 1; i < args.length; i++) {
    out -= args[i].value;
  }
  return new Value(dag, out);
};

/**
 * Returns arg[0] / arg[1] / arg[2] ... / arg[n]
 */
export const Div = (dag: DAG, args: Value[]): Value => {
  let out = args[0].value;
  for (let i = 1; i < args.length; i++) {
    out /= args[i].value;
  }
  return new Value(dag, out);
};

/**
 * Returns args[0] ** args[1]
 */
export const Pow = (dag: DAG, args: Value[]): Value => {
  const out = args[0].value ** args[1].value;
  return new Value(dag, out);
};

/**
 * Returns args[0] ^ (1 / args[1])
 */
export const Root = (dag: DAG, args: Value[]): Value => {
  const out = args[0].value ** (1 / args[1].value);
  return new Value(dag, out);
};

/**
 * Returns log(args[0], base e)
 */
export const Log = (dag: DAG, args: Value[]): Value => {
  const out = Math.log(args[0].value);
  return new Value(dag, out);
};

/**
 * Returns log(args[0], base 10)
 */
export const Log10 = (dag: DAG, args: Value[]): Value => {
  const out = Math.log10(args[0].value);
  return new Value(dag, out);
};

/**
 * Returns log(args[0], base 2)
 */
export const Log2 = (dag: DAG, args: Value[]): Value => {
  const out = Math.log2(args[0].value);
  return new Value(dag, out);
};

/**
 * Rounds to nearest int
 */
export const Round = (dag: DAG, args: Value[]): Value => {
  const out = Math.round(args[0].value);
  return new Value(dag, out);
};

/**
 * Rounds up to nearest int
 */
export const Ceiling = (dag: DAG, args: Value[]): Value => {
  const out = Math.ceil(args[0].value);
  return new Value(dag, out);
};

/**
 * Rounds down to nearest int
 */
export const Floor = (dag: DAG, args: Value[]): Value => {
  const out = Math.floor(args[0].value);
  return new Value(dag, out);
};

/**
 * Returns args[0] ^ args[1]
 */
export const BitwiseXor = (dag: DAG, args: Value[]): Value => {
  const out = args[0].value ^ args[1].value;
  return new Value(dag, out);
};

/**
 * Returns args[0] | args[1]
 */
export const BitwiseOr = (dag: DAG, args: Value[]): Value => {
  const out = args[0].value | args[1].value;
  return new Value(dag, out);
};
