/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Look for tests in __tests__ at the root of this package
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts"],
  // Run tests serially to avoid SQLite file contention (--runInBand CLI flag)
  // Reset module registry between test files to get clean DB state
  clearMocks: true,
};
