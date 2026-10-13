// Older saved CVs stored location as the first contact entry.
// Read both formats without rewriting saved application content.
export function cvHeader(cv: { location?: string; contact: string[] }) {
  if (cv.location !== undefined) return { location: cv.location, contact: cv.contact };
  return { location: cv.contact[0] || '', contact: cv.contact.slice(1) };
}
