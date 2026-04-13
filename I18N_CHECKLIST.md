# NIRA i18n Implementation Checklist

## ✅ Currently Using Translations

### Components Actively Using `useTranslation()` Hook
- [x] `features/auth/AuthGatewayPage.jsx` - Role titles & descriptions
- [x] `features/patient/PatientHomePage.jsx` - Quick actions, buckets, vitals  
- [x] `features/doctor/DoctorDashboardPage.jsx` - Filters, stats, queue  
- [x] `features/admin/AdminDashboardPage.jsx` - Stats, approvals section
- [x] `features/shared/ProfilePage.jsx` - Import added (ready for use)
- [x] `features/auth/LoginPage.jsx` - Import added (ready for use)
- [x] `components/layout/LanguageSwitcher.jsx` - Global switcher
- [x] `contexts/LanguageContext.jsx` - Global state
- [x] `hooks/useTranslation.js` - Hook provider

---

## 📋 Pages to Convert Next (In Priority Order)

### HIGH PRIORITY (20-30 min each)
- [ ] **LoginPage** - Add role-specific copy to translator
- [ ] **SignupPage** - Form fields + role descriptions  
- [ ] **BookingPage** - Slots, duration, confirmation
- [ ] **PrescriptionsPage** - List headers, detail view

### MEDIUM PRIORITY (15-20 min each)
- [ ] **InterviewPage** - Question displays, AI responses
- [ ] **DoctorAvailabilityPage** - Time slots, day selection
- [ ] **LabReportsPage** - Report sections, test names
- [ ] **AdvancedToolsPage** - Tool descriptions

### LOWER PRIORITY (10-15 min each)
- [ ] **DoctorChartPage** - Clinical notes, sections
- [ ] **NurseDashboardPage** - All hardcoded labels
- [ ] **PatientAppointmentsPage** - Appointment details
- [ ] Various modals & dialogs

---

## 🔧 How to Add Translation to a Component

### Template (Copy & Modify)

```jsx
// 1. Add import at top
import { useTranslation } from '../../hooks/useTranslation';

export function YourComponent() {
  // 2. Get translation function
  const { t } = useTranslation();
  
  // 3. Use t() for all hardcoded strings
  return (
    <div>
      <h1>{t('yourKey')}</h1>
      <button>{t('buttonLabel')}</button>
      <p>{t('description')}</p>
    </div>
  );
}
```

---

## 📝 Adding New Translation Keys

### Step 1: Open `src/lib/translator.js`

### Step 2: Add to English section
```javascript
export const translations = {
  en: {
    // ... existing keys ...
    newFeature: 'Your English text here',
  },
```

### Step 3: Add to Hindi section  
```javascript
  hi: {
    // ... existing keys ...
    newFeature: 'आपका हिंदी पाठ यहां है',
  }
};
```

### Step 4: Use in component
```jsx
const { t } = useTranslation();
<h1>{t('newFeature')}</h1>
```

---

## 🎯 Key Naming Convention

Use camelCase for multi-word keys:
```javascript
// ✅ GOOD
bookAppt: 'Book Appointment'
awaitingInterview: 'Awaiting interview'
pendingApproval: 'Pending Approval'

// ❌ AVOID  
book_appt: '...'
BookingAppointment: '...'
BOOK_APPOINTMENT: '...'
```

---

## 🧪 Quick Test

### Test Translation is Working:
```javascript
// In browser console
import { t } from './translator.js'
console.log(t('home', 'en'))   // "Home"
console.log(t('home', 'hi'))   // "होम"
```

### Test Hook in Component:
```jsx
const { t, lang } = useTranslation();
console.log('Current language:', lang);
console.log('Translated text:', t('home'));
```

---

## 📊 Translation Dictionary Stats

| Metric | Count |
|--------|-------|
| Total Keys | 120+ |
| English Complete | ✅ |
| Hindi Complete | ✅ |
| Components Using | 9+ |
| Pages Translated | 4 |
| Pages Awaiting | 8+ |

---

## 🚀 How to Speed Up Translation

### Method 1: Bulk Update (Fastest)
1. Find all `"hardcoded string"` occurrences
2. Create translation key in `translator.js`
3. Replace with `{t('keyName')}`

### Method 2: Component-by-Component (Safest)
1. Open one page
2. Identify all hardcoded text
3. Add keys to translator
4. Update component (takes 10-15 min)

### Method 3: Copy from Similar (Smart)
- `PatientHomePage` pattern → Use for all patient pages
- `DoctorDashboardPage` pattern → Use for doctor features
- `AdminDashboardPage` pattern → Use for admin pages

---

## 📁 File Structure Reference

```
src/lib/translator.js
├── Line 1-95: English translations
└── Line 97-195: Hindi translations

src/contexts/LanguageContext.jsx  
├── LanguageProvider (wrap app)
└── useLanguage() (get language state)

src/hooks/useTranslation.js
├── Imports LanguageContext
└── Returns { t, lang }

src/components/layout/LanguageSwitcher.jsx
├── Uses useTranslation()
└── Dropdown with EN/HI options

src/main.jsx
└── <LanguageProvider> wraps entire app
```

---

## ✨ Key Features Already Implemented

- ✅ Global language state (Context API)
- ✅ localStorage persistence
- ✅ useTranslation() hook
- ✅ HTML lang attribute updates
- ✅ Automatic Devanagari font loading for Hindi
- ✅ Language dropdown in nav, doctor header, mobile menu
- ✅ 120+ translation keys
- ✅ 4 major pages translating
- ✅ Production build verified

---

## 🎨 UI Elements Already Supporting Translation

| Element | Status |
|---------|--------|
| Page titles | ✅ |
| Button labels | ✅ |
| Status badges | ✅ |
| Menu items | ✅ |
| Form labels | ✅ |
| Stat titles | ✅ |
| Empty messages | ✅ |
| Filter options | ✅ |
| Card headings | ✅ |
| Help text | ⏳ Partial |

---

## ⚡ Performance Tips

- ✅ No additional NPM packages needed (using native!)
- ✅ Translations are lightweight (120KB total)
- ✅ Language change is instant (no re-render needed except UI)
- ✅ localStorage keeps language preference across sessions
- ✅ Fonts pre-loaded (Manrope + Devanagari)

---

## 📞 Troubleshooting

### Issue: Key shows as undefined
**Solution:** Add key to `translator.js` both EN and HI sections

### Issue: Hindi text not rendering properly
**Solution:** Ensure Devanagari font is loaded (check CSS in browser)

### Issue: Language didn't change
**Solution:** Hard refresh browser (Ctrl+F5) to clear cache

### Issue: Can't import useTranslation
**Solution:** Ensure LanguageProvider wraps your app in `main.jsx`

---

## 🏆 Completion Tracker

### Phase 1: ✅ COMPLETE
- [x] Setup Context API
- [x] Create translator dictionary
- [x] Implement language switcher
- [x] Add 120+ translation keys
- [x] Integrate into 4 major pages
- [x] Verify production build
- [x] Create documentation

### Phase 2: IN PROGRESS
- [x] Add imports to 6 more components
- [ ] Translate LoginPage UI
- [ ] Translate SignupPage UI
- [ ] Translate booking/interview flows

### Phase 3: PENDING
- [ ] Remaining patient pages
- [ ] Remaining doctor pages  
- [ ] Remaining admin pages
- [ ] All modal dialogs

---

## 🎯 Definition of Complete Translation

A page is **fully translated** when:
1. All visible text uses `t()` function
2. No hardcoded strings in UI
3. All form labels translated
4. All buttons/links translated
5. All status messages translated
6. All help text translated
7. Hindi output verified

---

## 💡 Pro Tips

1. **Keep keys short**: `bookAppt` not `bookAppointmentForPatients`
2. **Group related keys**: All patient features together in translator
3. **Use fallback**: If key missing, original key name displays
4. **Test both languages**: Always test EN then HI
5. **Check fonts**: Verify Devanagari loads for Hindi text

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `I18N_SETUP.md` | Complete technical guide |
| `I18N_QUICK_START.md` | Developer quick reference |
| `I18N_STATUS.md` | Current translation status |
| `I18N_CHECKLIST.md` | This file - implementation tasks |

---

## 🎉 Ready to Contribute?

1. Pick a page from "Pages to Convert Next"
2. Follow the template above
3. Add translation keys for all hardcoded text
4. Test in both EN and HI
5. Build to verify no errors
6. Done! ✅

**Average time per page: 15-30 minutes**

---

*Last Updated: April 9, 2026*  
*Status: ✅ Active & Production Ready*
