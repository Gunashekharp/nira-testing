# NIRA i18n (Internationalization) Guide

## Overview
The NIRA frontend now supports multiple languages with English and Hindi as the first two languages. The language switcher is integrated globally and automatically updates all UI text when toggled.

## Files Created

### 1. **translator.js** 
Location: `src/lib/translator.js`
- Contains all translation strings for English and Hindi
- Export function `t(key, lang)` - translates a key to the specified language
- Export object `translations` - contains all language dictionaries

### 2. **LanguageContext.jsx**
Location: `src/contexts/LanguageContext.jsx`
- React Context for managing language state globally
- Provider component: `LanguageProvider` - wrap your app with this
- Hook: `useLanguage()` - access current language and language setter
- Automatically saves language preference to localStorage
- Sets HTML `lang` attribute for accessibility
- Adjusts font family based on language (Devanagari fonts for Hindi)

### 3. **LanguageSwitcher.jsx**
Location: `src/components/layout/LanguageSwitcher.jsx`
- Interactive dropdown component to switch between languages
- Shows flag emojis (🇺🇸 for English, 🇮🇳 for Hindi)
- Integrated into the main AppShell header

### 4. **useTranslation Hook**
Location: `src/hooks/useTranslation.js`
- Custom React hook for easy access to translator
- Returns `{ t, lang }` where `t` is the translation function
- Automatically handles language context

## How to Use

### In Any React Component

```jsx
import { useTranslation } from '../hooks/useTranslation';

export function MyComponent() {
  const { t, lang } = useTranslation();
  
  return (
    <div>
      <h1>{t('home')}</h1>
      <p>{t('bookAppt')}</p>
      <button>{t('submit')}</button>
      {/* Current language: {lang} */}
    </div>
  );
}
```

### Adding New Translation Keys

1. Open `src/lib/translator.js`
2. Add your key and translation to both English and Hindi dictionaries:

```javascript
export const translations = {
  en: {
    // ... existing keys ...
    myNewKey: 'My English Text'
  },
  hi: {
    // ... existing keys ...
    myNewKey: 'मेरा हिंदी पाठ'
  }
};
```

3. Use it in any component:
```jsx
const { t } = useTranslation();
<span>{t('myNewKey')}</span>
```

## Available Translation Keys

### Navigation & Common
- `home`, `dashboard`, `profile`, `logout`, `login`, `signup`, `back`, `next`, `save`, `cancel`, `delete`, `edit`, `submit`, `loading`, `error`, `success`, `settings`

### Patient Features
- `bookAppt`, `myAppts`, `myRx`, `labReports`, `aiCheck`, `nextSlot`, `downloadRx`, `viewDetails`, `cancelAppt`, `reschedule`, `symptoms`, `vitals`, `prescription`, `doctor`, `date`, `time`, `status`

### Doctor Features
- `patients`, `appointments`, `myPatients`, `availability`, `setAvailability`, `patientHistory`, `writeRx`, `viewChart`, `addNotes`, `approved`, `pending_approval`

### Admin Features
- `admins`, `doctors`, `manage`, `approval`, `approveDr`, `rejectDr`, `statistics`, `totalUsers`, `totalAppts`, `totalRx`, `userManagement`

### Nurse Features
- `nurse`, `nurseSchedule`, `patientCare`

### Auth Features
- `email`, `password`, `phone`, `name`, `role`, `patient`, `alreadyHaveAccount`, `createAccount`, `forgotPassword`, `resetPassword`

### Messages
- `welcome`, `selectRole`, `confirmAction`, `saved`, `deleted`, `updated`, `noData`, `language`

## Status Translations

- `pending`: पेंडिंग / Pending
- `confirmed`: पुष्टि की गई / Confirmed  
- `completed`: पूर्ण / Completed
- `cancelled`: रद्द किया गया / Cancelled

## How Language Switching Works

1. User clicks the language dropdown in the top navigation
2. Language preference is saved to `localStorage` with key `language`
3. HTML `lang` attribute is updated for accessibility
4. Font family is adjusted (Hindi uses Noto Sans Devanagari)
5. All components using `useTranslation()` hook automatically re-render with new language

## Fallback Behavior

If a translation key doesn't exist, the key itself is returned. This helps with finding missing translations during development:

```jsx
{t('unknownKey')} // Displays: unwknownKey
```

## Component Integration

The language switcher is integrated into:
- **Top Navigation** (for desktop/tablet users)
- **Doctor's Sub-header** (for doctor role)
- **Mobile Drawer** (for mobile users)

All these locations now use the LanguageSwitcher component, which automatically updates globally when language is changed.

## Adding Support for More Languages

1. Add new language to both files:

**translator.js:**
```javascript
export const translations = {
  en: { /* ... */ },
  hi: { /* ... */ },
  es: {  // Spanish example
    home: 'Inicio',
    bookAppt: 'Reservar Cita',
    // ... add all keys
  }
};
```

**LanguageContext.jsx** - Update the validation:
```javascript
if (['en', 'hi', 'es'].includes(newLang)) {
  setLang(newLang);
}
```

**LanguageSwitcher.jsx** - Add new option:
```jsx
<option value="es">🇪🇸 Español</option>
```

## Font Support

The project already has font imports for:
- **Manrope** (English) - 400, 500, 600, 700 weights
- **Noto Sans Devanagari** (Hindi) - 400, 500, 600, 700 weights

When Hindi is selected, fonts automatically switch to Devanagari for proper rendering.

## localStorage Key

Language preference is stored in `localStorage` under:
- Key: `language`
- Value: `'en'` or `'hi'` (or other language codes)
- Persists across browser sessions

## Accessibility

- HTML `lang` attribute is updated with current language
- LanguageSwitcher includes accessible label
- Proper ARIA attributes for dropdown
- Keyboard navigation support

## Best Practices

1. **Use the hook in all components**: Import and use `useTranslation()` instead of hardcoding text
2. **Keep translations concise**: Shorter strings are easier to maintain
3. **Use consistent terminology**: When new translations are added, review existing similar keys
4. **Test both languages**: Always verify translations display correctly in both English and Hindi

## Debugging

To check current language:
```jsx
const { t, lang } = useTranslation();
console.log('Current language:', lang);
```

To verify translation file is loaded:
```jsx
import { translations } from '../lib/translator';
console.log('Available keys:', Object.keys(translations.en));
```

## Example: Converting a Component

**Before:**
```jsx
export function MyComponent() {
  return (
    <div>
      <h1>Home</h1>
      <button>Book Appointment</button>
    </div>
  );
}
```

**After:**
```jsx
import { useTranslation } from '../hooks/useTranslation';

export function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('home')}</h1>
      <button>{t('bookAppt')}</button>
    </div>
  );
}
```

## Summary

✅ Global language switching with English & Hindi support
✅ LocalStorage persistence
✅ Automatic font switching  
✅ Easy-to-use translation hook
✅ Integrated language switcher in UI
✅ Extensible for additional languages
✅ Fallback key display for missing translations
✅ Full accessibility support
