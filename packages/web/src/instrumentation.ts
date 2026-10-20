export async function register() {
  /*
   * The Node-only code lives in its own module and is imported inside this
   * branch, so the Edge build drops it instead of warning about Node APIs.
   */
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
