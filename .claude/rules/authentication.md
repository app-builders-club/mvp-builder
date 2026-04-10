# Authentication Standards

## By Platform

| Platform | Library |
|----------|---------|
| Next.js App Router | Auth.js v5 (`next-auth@beta`) + `@auth/prisma-adapter` |
| Express / Node API | Passport.js + JWT strategy |
| React Native / Expo | Expo Auth Session |
| iOS (Swift) | Sign in with Apple + Keychain for token storage |
| Android (Kotlin) | Google Identity Services + EncryptedSharedPreferences |
| Flutter | firebase_auth or flutter_appauth + flutter_secure_storage |
| Browser Extension | OAuth 2.0 via `chrome.identity` / `browser.identity` + `chrome.storage.session` |
| Python (FastAPI) | fastapi-users + python-jose + passlib |
| Python (Django) | django-allauth + djangorestframework-simplejwt |

## Non-negotiable Rules

- Secrets via env only — never hardcode
- Never store sensitive data in JWT payload (it's readable)
- Never use credentials-based auth without password hashing (`argon2` or `bcrypt`)
- Password hashing on server only — never client-side
- Tokens: access token ≤15min, refresh token in httpOnly cookie
- Mobile: always use platform secure storage — never plain AsyncStorage or localStorage
- Browser extensions: never `localStorage` for tokens — use `chrome.storage.session`
- Session strategy: `jwt` for serverless, `database` when sessions must be revocable
- Next.js route protection: middleware only, never page-level checks
- Next.js type extensions: always via `types/next-auth.d.ts`