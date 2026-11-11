/**
 * @file Jest global setup that runs once before the test suite.
 */

/**
 * Prepares the Jest run before any test file executes.
 *
 * No external services are required, so nothing is started.
 * @example
 * ```ts
 * // Jest runs this automatically when it is configured as globalSetup.
 * await setup();
 * ```
 */
export default async function setup(): Promise<void> {
  // No external services are required for the test suite.
}
