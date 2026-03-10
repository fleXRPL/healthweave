// CJS mock for uuid (v13 is pure ESM, incompatible with Jest CommonJS runner)
let count = 0;
module.exports = { v4: () => `mock-uuid-${++count}` };
