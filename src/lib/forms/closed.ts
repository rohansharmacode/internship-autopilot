/** The posting has been taken down even though a list still shows it. */
export class PostingClosedError extends Error {
  constructor() {
    super("This posting has closed, so it was removed from your list.");
  }
}
