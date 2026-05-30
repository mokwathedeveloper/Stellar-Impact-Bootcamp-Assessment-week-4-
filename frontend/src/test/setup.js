// Global test setup — runs before every test file
import "@testing-library/jest-dom";

// Silence expected console.error output from React error-boundary renders
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning:") || args[0].includes("Error:"))
    )
      return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
