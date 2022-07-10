import { DAG, Expr } from "../core";
import { Parser, Operator } from "../parser";

function testParsing(input: string, expected: any, debug = false, dag?: DAG) {
  dag = dag || new DAG();
  const p = new Parser(dag);
  p.setOP(new Operator("-", 10, -1, 100))
    .setOP(new Operator("+", 10, -1, 100))
    .setOP(new Operator("%", 20))
    .setOP(new Operator("*", 30))
    .setOP(new Operator("/", 30))
    .setOP(new Operator("^", 40))
    .setOP(new Operator("|", 50));
  const e1 = p.parse(input);
  const found = e1.debugValue();
  if (debug) {
    console.log("Found: ", JSON.stringify(found, null, 2));
    console.log("Expected: ", JSON.stringify(expected, null, 2));
  }
  expect(found).toEqual(expected);
}

describe("Tests for debugging", () => {
  test("Current", () => {
    testParsing("func(- 3 + - 5, true)", {
      func: "func",
      args: [
        {
          func: "+",
          args: [
            {
              func: "-",
              args: [3],
            },
            {
              func: "-",
              args: [5],
            },
          ],
        },
        true,
      ],
    });
  });
});

describe("Parser Tests", () => {
  test("Test Basic Parsing", () => {
    testParsing("true", true);
    testParsing("false", false);
    testParsing("-3", -3);
    testParsing("3", 3);
    testParsing('"3"', "3");
    testParsing('r#"\n3\n"#', "\n3\n");
  });

  test("Test Op Parsing", () => {
    testParsing("1 + 2", { args: [1, 2], func: "+" });
    testParsing("1 + 2 + 3", {
      func: "+",
      args: [
        {
          func: "+",
          args: [1, 2],
        },
        3,
      ],
    });
    testParsing("- 3", { args: [3], func: "-" });
  });

  test("Test Func Parsing", () => {
    testParsing('func(3, true,   "5")', { args: [3, true, "5"], func: "func" });
    testParsing("func(- 3 + - 5, true)", {
      func: "func",
      args: [
        {
          func: "+",
          args: [
            {
              func: "-",
              args: [3],
            },
            {
              func: "-",
              args: [5],
            },
          ],
        },
        true,
      ],
    });
    testParsing('func(3 + 5, true | false, xyz + "5" + 10 / 11)', {
      func: "func",
      args: [
        {
          func: "+",
          args: [3, 5],
        },
        {
          func: "|",
          args: [true, false],
        },
        {
          func: "+",
          args: [
            {
              func: "+",
              args: ["Var(xyz)", "5"],
            },
            {
              func: "/",
              args: [10, 11],
            },
          ],
        },
      ],
    });
  });

  test("Test OpPrec Parsing", () => {
    testParsing("1 + 2 + 3 + 4 + 5", {
      func: "+",
      args: [
        {
          func: "+",
          args: [
            {
              func: "+",
              args: [
                {
                  func: "+",
                  args: [1, 2],
                },
                3,
              ],
            },
            4,
          ],
        },
        5,
      ],
    });
  });
});
