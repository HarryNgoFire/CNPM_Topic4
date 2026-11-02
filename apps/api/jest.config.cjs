module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.spec.ts"],
  collectCoverageFrom: [
    "src/modules/{pricing,dispatch,webhooks,shipments,auth,users}/**/*.service.ts",
    "src/modules/shipments/state-machine.ts",
    "src/common/security.ts",
  ],
  coverageThreshold: {
    global: { statements: 60, branches: 60, functions: 60, lines: 60 },
  },
};
