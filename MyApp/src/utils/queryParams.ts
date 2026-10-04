/** Strips undefined/null/empty-string values so they aren't serialized into the query string. */
export function cleanParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  const result: Partial<T> = {};
  (Object.keys(params) as (keyof T)[]).forEach(key => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  });
  return result;
}
