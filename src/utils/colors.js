export const CATEGORIES = [
  { id: 'personal',  label: 'personal',  color: '#9370DB' },
  { id: 'family',    label: 'family',    color: '#9370DB' },
  { id: 'travel',    label: 'travel',    color: '#C8A96E' },
  { id: 'career',    label: 'career',    color: '#4A90D9' },
  { id: 'home',      label: 'home',      color: '#38B2AC' },
  { id: 'health',    label: 'health',    color: '#E85D75' },
  { id: 'education', label: 'education', color: '#5CAD6E' },
]

export const CATEGORY_COLOR = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c.color])
)

export function categoryColor(category) {
  return CATEGORY_COLOR[category] ?? '#C8A96E'
}
