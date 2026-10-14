const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Keep canonical dates in storage; format them consistently in previews and PDFs.
// Leave year-only dates and labels such as Present intact, without inventing months.
export function formatEmploymentDate(value: string): string {
  const date = value.trim();
  const yearFirst = /^(\d{4})-(\d{1,2})$/.exec(date);
  const monthFirst = /^(\d{1,2})-(\d{4})$/.exec(date);
  if (!yearFirst && !monthFirst) return value;
  const year = yearFirst ? yearFirst[1] : monthFirst![2];
  const month = Number(yearFirst ? yearFirst[2] : monthFirst![1]);
  return month >= 1 && month <= 12 ? `${months[month - 1]} ${year}` : value;
}
