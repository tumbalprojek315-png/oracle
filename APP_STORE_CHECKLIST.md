# Publishing Oracle to the App Store: checklist

Based on Apple's App Review Guidelines (developer.apple.com/app-store/review/guidelines).
Items marked **[in app]** are already built into Oracle; the rest are things you do.

## 1. Required before you can submit

- [ ] **Apple Developer Program** membership (USD 99/year) and an App Store Connect account.
- [ ] **Wrap Oracle as a native app** (guideline 4.2: no "repackaged website"). Recommended: [Capacitor](https://capacitorjs.com)
  - `npm init @capacitor/app` → point `webDir` at this folder, `npx cap add ios`.
  - Add `@capacitor/local-notifications`: Oracle's reminder engine (`src/notifications.js`) already detects it and schedules reminders with iOS, so they arrive even when the app is closed.
  - Build in Xcode (needs a Mac, or a cloud Mac / CI service).
- [ ] **Privacy policy URL** for App Store Connect (5.1.1(i)). The text is in the app (**[in app]** You → Privacy policy); publish the same text on a web page and put its link in `src/config.js` → `privacyUrl`.
- [ ] **Support contact** (1.5): set `src/config.js` → `supportEmail`. The "Contact support" row appears automatically once it is set.
- [ ] **Publisher name** in `src/config.js` → `developer`.
- [ ] **App Privacy "nutrition label"** in App Store Connect: answer **"Data Not Collected"**. Oracle stores everything on the device and sends nothing.
- [ ] **Age rating** questionnaire (expected: 4+).
- [ ] **Screenshots** (6.7" and 6.5" iPhone) using **sample data, not real personal data** (2.3.9).
- [ ] **Review notes** (2.3.1): explain that Oracle is a personal record-keeping tool. It has no bank connection, no payments and no account, data stays on the device, and reminders are optional local notifications.

## 2. Already in the app

- [x] **[in app]** Privacy policy, Terms of use, Financial disclaimer ("not financial advice, not a bank"), Open-source licenses (You → About & legal).
- [x] **[in app]** First-launch welcome with links to Terms and Privacy policy.
- [x] **[in app]** No account, no sign-in, no personal data required (5.1.1(v)); name is optional.
- [x] **[in app]** Delete all data, with confirmation (You → Delete all data).
- [x] **[in app]** Notifications are optional, never required, off by default, and hide amounts on the lock screen unless turned on (4.5.4, 5.1.2(i)).
- [x] **[in app]** Works offline; export to Excel/CSV; data portability via sync files.
- [x] **[in app]** Accessibility: light/dark theme, text size (Small → XL), 4.5:1+ text contrast, screen-reader labels.
- [x] **[in app]** English and Bahasa Indonesia.

## 3. Strongly recommended

- [ ] Have the legal texts (`src/legal.js`) reviewed by a lawyer if you charge money or publish under a company.
- [ ] Self-host the two fonts (Space Grotesk, Manrope) instead of loading them from Google Fonts, so the native app makes no network requests at all.
- [ ] Add the iOS permission text for notifications (Info.plist) in plain words, e.g. "Oracle reminds you to log meals you usually log, only if you haven't yet."
- [ ] If you ever add money (subscriptions or one-off unlocks), use Apple In-App Purchase (3.1.1).
- [ ] Bump `APP.version` / `APP.build` in `src/config.js` for every release.
