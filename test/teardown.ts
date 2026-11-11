/**
 * @file Jest global teardown that runs once after the test suite.
 */

/**
 * Cleans up after the Jest run once every test file has finished.
 *
 * No external services are running, so there is nothing to stop.
 * @example
 * ```ts
 * // Jest runs this automatically when it is configured as globalTeardown.
 * await teardown();
 * ```
 */
export default async function teardown(): Promise<void> {
  // No external services to tear down.
}
