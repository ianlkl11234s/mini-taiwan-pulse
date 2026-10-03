/**
 * Loopback-only test identity (SPEC-prod-connect §2.6): DEV build plus
 * VITE_RESEARCH_TEST_IDENTITY=1. The gateway accepts this bearer only from a loopback
 * caller with PULSE_RESEARCH_TEST_IDENTITY=1. In a production build `import.meta.env.DEV`
 * is false, so both constants fold away and the literal never reaches dist/.
 */
export const TEST_IDENTITY = import.meta.env.DEV && import.meta.env.VITE_RESEARCH_TEST_IDENTITY === "1";
export const TEST_BROWSER_TOKEN = TEST_IDENTITY ? "test-local" : "";
