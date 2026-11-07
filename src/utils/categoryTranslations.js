/**
 * Centralized Category Display Name Translation Helper (Phase 11.2)
 * 
 * Maps internal category names and Firestore identifiers to localized
 * display labels in English and Tamil without mutating stored database values.
 */

export const STANDARD_CATEGORY_MAP = {
  'Daily Activity': {
    en: 'Daily Activity',
    ta: 'தினசரி செயல்பாடு'
  },
  'Agriculture': {
    en: 'Agriculture',
    ta: 'விவசாயம்'
  },
  'Personal': {
    en: 'Personal',
    ta: 'தனிப்பட்ட'
  },
  'Family': {
    en: 'Family',
    ta: 'குடும்பம்'
  },
  'Business': {
    en: 'Business',
    ta: 'வணிகம்'
  },
  'Important Event': {
    en: 'Important Event',
    ta: 'முக்கிய நிகழ்வு'
  },
  'Reminder': {
    en: 'Reminder',
    ta: 'நினைவூட்டல்'
  },
  'Income': {
    en: 'Income',
    ta: 'வரவு'
  },
  'Expense': {
    en: 'Expense',
    ta: 'செலவு'
  },
  'Other': {
    en: 'Other',
    ta: 'மற்றவை'
  },
  'All': {
    en: 'All Categories',
    ta: 'அனைத்து வகைகள்'
  }
};

/**
 * Returns localized category name according to user language preference
 */
export function getCategoryDisplayName(categoryName, language = 'en') {
  if (!categoryName || (typeof categoryName === 'string' && !categoryName.trim())) {
    return language === 'ta' ? 'மற்றவை' : 'Other';
  }

  const trimmed = typeof categoryName === 'string' ? categoryName.trim() : String(categoryName);
  const matched = STANDARD_CATEGORY_MAP[trimmed];

  if (matched) {
    return language === 'ta' ? matched.ta : matched.en;
  }

  // Case-insensitive check
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(STANDARD_CATEGORY_MAP)) {
    if (key.toLowerCase() === lower) {
      return language === 'ta' ? val.ta : val.en;
    }
  }

  // If custom category name, return as-is
  return trimmed;
}

/**
 * Returns CSS class for natural pastel category chips
 */
export function getCategoryChipClass(categoryName) {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('agri') || cat.includes('விவசாயம்')) return 'chip-green';
  if (cat.includes('fam') || cat.includes('குடும்பம்')) return 'chip-amber';
  if (cat.includes('bus') || cat.includes('வணிகம்')) return 'chip-purple';
  if (cat.includes('per') || cat.includes('தனிப்பட்ட')) return 'chip-blue';
  if (cat.includes('inc') || cat.includes('வரவு')) return 'chip-green';
  if (cat.includes('exp') || cat.includes('செலவு')) return 'chip-rose';
  if (cat.includes('event') || cat.includes('நிகழ்வு')) return 'chip-amber';
  if (cat.includes('rem') || cat.includes('நினைவூட்டல்')) return 'chip-blue';
  return 'chip-green';
}
