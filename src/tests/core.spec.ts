import { DAG, Units } from "../core";
import * as stdlib from "../stdlib";

describe("DAG Tests", () => {
  test("Create a DAG and some units", () => {
    const d = new DAG();

    const u1 = d.newUnits(["a", "b", "c"], ["c", "d"]);
    const u2 = d.newUnits(["c", "a", "b"], ["d", "c"]);

    expect(u1).toBe(u2);

    expect(d.newBool(true)).toBe(d.TRUE);
    expect(d.newBool(true)).toBe(d.TRUE);
    expect(d.newBool(false)).toBe(d.FALSE);
    expect(d.newBool(false)).toBe(d.FALSE);
  });

  test("Create VARs and Circular Ref", () => {
    const d = new DAG();
    d.regFunc("+", stdlib.Plus);
    const vx = d.newVar("x", d.newNum(3));
    const vy = d.newVar("y", d.newNum(5));
    const vz = d.newVar("z", d.newFunc("+", [d.newVarRef("x"), d.newVarRef("y")]));
    expect(() => d.setValue("x", d.newVarRef("z"))).toThrowError("Circular reference for variable: x");
  });
});
