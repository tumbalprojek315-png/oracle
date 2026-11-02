// Meal-time bucketing for Food entries. Boundaries: before 11:00 = Breakfast,
// 11:00-13:59 = Lunch, 14:00-16:59 = Afternoon, 17:00+ = Dinner. Internal
// keys (pagi/siang/sore/malam) are unchanged from the original spec and only
// used as lookup keys — never shown to the user.
export const MEAL_BUCKETS = [
  { key: 'pagi', label: 'Breakfast', range: 'Before 11:00' },
  { key: 'siang', label: 'Lunch', range: '11:00-13:59' },
  { key: 'sore', label: 'Afternoon', range: '14:00-16:59' },
  { key: 'malam', label: 'Dinner', range: 'From 17:00' },
];

export function mealBucket(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  const minutes = h * 60 + (Number.isFinite(m) ? m : 0);
  if (minutes < 11 * 60) return 'pagi';
  if (minutes < 14 * 60) return 'siang';
  if (minutes < 17 * 60) return 'sore';
  return 'malam';
}

export function mealBucketLabel(key) {
  return (MEAL_BUCKETS.find((b) => b.key === key) || {}).label || '';
}

export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
