// The analysis prompt uses "Not specified". Also accept common equivalent
// placeholders from models so they never become the company on an application.
export function isMissingCompanyName(value: string): boolean {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/, '');
  return (
    !name ||
    /^(?:(?:company(?: name)?|employer)\s*:?\s*)?(?:not (?:specified|provided|mentioned|known|disclosed|available)|unknown|unspecified|undisclosed|confidential|n\/?a|none|null)$/.test(
      name,
    )
  );
}
