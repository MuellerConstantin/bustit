/**
 * A filter that isn't valid RSQL or asks for something the list doesn't
 * allow. Its message says what, so it can be passed on to the client.
 */
export class InvalidFilterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidFilterError';
  }
}
