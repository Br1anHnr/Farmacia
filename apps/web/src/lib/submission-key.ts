/** Retain the same key after an uncertain response; changed payloads start a new operation. */
export function submissionKey() {
  let previous: { payload: string; key: string } | null = null;
  return {
    forPayload(payload: unknown) {
      const serialized = JSON.stringify(payload);
      if (!previous || previous.payload !== serialized) {
        previous = { payload: serialized, key: crypto.randomUUID() };
      }
      return previous.key;
    },
    reset() { previous = null; },
  };
}
