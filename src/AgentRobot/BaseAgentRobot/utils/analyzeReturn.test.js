const assert = require('assert')
const { analyzeReturn } = require('./normal')

function runCase(name, code, expected) {
  const actual = analyzeReturn(code)
  assert.deepStrictEqual(
    actual,
    expected,
    `${name} failed\nexpected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(actual)}\ncode:\n${code}`,
  )
}

function run() {
  const cases = [
    {
      name: 'empty input',
      code: '',
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'non-string input',
      code: null,
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'top-level return with number',
      code: 'const x = 1\nreturn x + 1',
      expected: { hasReturn: true, hasReturnValue: true },
    },
    {
      name: 'top-level bare return',
      code: 'if (ok) {\n  return\n}\nreturn;',
      expected: { hasReturn: true, hasReturnValue: false },
    },
    {
      name: 'ASI after return newline',
      code: "return\n'hello'",
      expected: { hasReturn: true, hasReturnValue: false },
    },
    {
      name: 'return with inline comment and value',
      code: 'return /* explain */ 42',
      expected: { hasReturn: true, hasReturnValue: true },
    },
    {
      name: 'return with line comment then newline',
      code: 'return // explain\n42',
      expected: { hasReturn: true, hasReturnValue: false },
    },
    {
      name: 'return object literal',
      code: 'return { ok: true }',
      expected: { hasReturn: true, hasReturnValue: true },
    },
    {
      name: 'return template literal',
      code: 'return `done:${1}`',
      expected: { hasReturn: true, hasReturnValue: true },
    },
    {
      name: 'ignore return in string/comment',
      code: "const s = 'return 1'\n// return 2\n/* return 3 */\nconst n = 4",
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'ignore return in nested function declaration',
      code: 'function inner() { return 1 }\nconst n = 1',
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'ignore return in nested arrow block',
      code: 'const fn = () => { return 1 }\nconst n = 1',
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'ignore return in class method',
      code: 'class A { m() { return 1 } }\nconst n = 1',
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'ignore return in object method',
      code: 'const obj = { m() { return 1 } }\nconst n = 1',
      expected: { hasReturn: false, hasReturnValue: false },
    },
    {
      name: 'top-level return exists even with nested returns',
      code: 'const fn = () => { return 1 }\nif (ok) { return 2 }',
      expected: { hasReturn: true, hasReturnValue: true },
    },
    {
      name: 'real-world code snippet from code.txt shape',
      code: "const fs = require('fs')\nconst content = 'x'\nreturn 'File updated successfully.'",
      expected: { hasReturn: true, hasReturnValue: true },
    },
  ]

  for (const testCase of cases) {
    runCase(testCase.name, testCase.code, testCase.expected)
  }

  console.log(`analyzeReturn tests passed: ${cases.length} cases`)
}

run()
