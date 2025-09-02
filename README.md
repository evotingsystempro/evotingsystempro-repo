# VR-Draught App

### 📌 Project Overview

The **VR-Draught App** is an essential tool for promoting **professionalism, accountability, and growth** in the game of draughts. It provides structured record-keeping, transparent tournament management, and digital tools for advancing the draught community.

---

## 🎯 Core Functions
* Maintain accurate **player records** and achievements.
* Track **tournament results** and association activities.
* Access **historical data** for analytics and progress tracking.
* Strengthen **transparency** and organization across the community.

---

## 🚀 Key Tech Features

* ✅ Google Authentication (Sign-Up & Login)
* ✅ Apple Authentication (iOS & Web)
* ✅ **BFF Architecture** with Expo API Routes
* ✅ JWT-based token management (for native apps)
* ✅ Cookies-based session management (for web)
* ✅ Cross-platform support (iOS, Android, Web)
* ✅ Automatic token refresh mechanism
* ✅ Protected API routes for secure data access
* ✅ AI-powered Customer Support System
* ✅ Real-Time Chat System
* ✅ Server-side email verification with **Node.js + Nodemailer (Google Cloud Run)**

---

## 🔑 Authentication Notes
This project supports **both tokens and cookies** depending on the platform:

* **Native (iOS/Android)** → Uses **JWT tokens**
* **Web** → Uses **Secure HTTP-only cookies**

### Why Cookies for Web?
* 🔒 Security: Cannot be accessed by JavaScript (prevents XSS)
* 📤 Automatic: Sent with every request to your domain
* 🛡️ CSRF Protection: Works seamlessly with CSRF tokens
* 🔄 Session Management: Easy to invalidate server-side
* 💾 No client-side storage: Avoids reliance on `localStorage` or `sessionStorage`

The API automatically detects the platform and:
* Sets a **secure HTTP-only cookie** for web requests
* Returns a **JWT token** in the response for native requests

---

## ⚙️ Prerequisites
* A [Google Cloud Console](https://console.cloud.google.com) project with **OAuth 2.0 credentials**
* An [Apple Developer Account](https://developer.apple.com/account/)

---

## 🌍 Environment Setup
Create a `.env.local` file in the root directory:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=your_jwt_secret  # used to sign JWT tokens
EXPO_PUBLIC_BASE_URL=your_base_url # e.g., http://localhost:8081
EXPO_PUBLIC_SCHEME=your_app_scheme:// # matches app.json scheme

# Generate yours at https://applekeygen.expo.app
APPLE_CLIENT_SECRET=
```

---

## ▶️ Get Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   npx expo run:ios   # iOS  
   npx expo run:android   # Android  
   ```

---

## 📂 Project Structure

Refer to the file explorer for detailed organization.

---

## 🍏 Apple Sign-In Setup (iOS + Web)

### iOS (Native via `expo-apple-authentication`)

Install:

```bash
npx expo install expo-apple-authentication
```

Enable capability in `app.json`:

```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true
    },
    "plugins": ["expo-apple-authentication"]
  }
}
```

### Web (OAuth via Expo Router API Routes)

For web-based Apple Sign-In:
1. Visit [Apple Key Generator](https://applekeygen.expo.app)
2. Enter your **Apple Developer Team ID** & **Bundle Identifier**
3. Generate and copy the **client secret**
4. Add it to your `.env` file

---

## 📚 Learn More
* [Expo Documentation](https://docs.expo.dev/)
* [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
* [JWT.io](https://jwt.io/)
* [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)

---

## 👥 Community

* [Expo on GitHub](https://github.com/expo/expo)
* [Expo Discord](https://chat.expo.dev)

---

