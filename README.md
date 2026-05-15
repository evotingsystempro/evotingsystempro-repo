# Smart People App 🧠

### 📌 Project Overview

**Smart People** is an AI-powered, cross-platform mobile and web application built to connect people through knowledge, real-time interaction, and gamified learning. It combines live chat, quizzes, scoreboards, wallet/credit systems, and AI-powered support into a seamless experience across iOS, Android, and Web.

---

## 🎯 Core Features

- 🧠 **AI-Powered Quiz System** — Topic-based quizzes with score tracking and leaderboards
- 💬 **Real-Time Chat** — Group and personal messaging with media support
- 🏆 **Scoreboard** — Live rankings with paginated Firestore data
- 💰 **Wallet & Credits** — Buy, send, and manage in-app credits with transaction history
- 📣 **Announcements** — App-wide and targeted announcements with modal components
- 👤 **User Profiles** — Complete profile management with image upload
- 🔔 **Push Notifications** — Real-time alerts using Expo Notifications
- 🤖 **AI Customer Support** — Intelligent support powered by Google Generative AI
- 🔐 **Secure Authentication** — Google & Apple Sign-In with JWT + Cookie-based sessions

---

## 🚀 Key Tech Features

- ✅ Google Authentication (Sign-Up & Login)
- ✅ Apple Authentication (iOS & Web)
- ✅ **BFF Architecture** with Expo API Routes
- ✅ JWT-based token management (for native apps)
- ✅ Cookies-based session management (for web)
- ✅ Cross-platform support (iOS, Android, Web)
- ✅ Automatic token refresh mechanism
- ✅ Protected API routes for secure data access
- ✅ AI-powered Customer Support System
- ✅ Real-Time Chat System
- ✅ Ethereum Wallet Integration
- ✅ Server-side email verification with **Node.js + Nodemailer (Google Cloud Run)**

---

## 🔑 Authentication Notes

This project supports **both tokens and cookies** depending on the platform:

- **Native (iOS/Android)** → Uses **JWT tokens**
- **Web** → Uses **Secure HTTP-only cookies**

### Why Cookies for Web?

- 🔒 **Security** — Cannot be accessed by JavaScript (prevents XSS)
- 📤 **Automatic** — Sent with every request to your domain
- 🛡️ **CSRF Protection** — Works seamlessly with CSRF tokens
- 🔄 **Session Management** — Easy to invalidate server-side
- 💾 **No client-side storage** — Avoids reliance on `localStorage` or `sessionStorage`

The API automatically detects the platform and:

- Sets a **secure HTTP-only cookie** for web requests
- Returns a **JWT token** in the response for native requests

---

## ⚙️ Prerequisites

- A [Google Cloud Console](https://console.cloud.google.com) project with **OAuth 2.0 credentials**
- An [Apple Developer Account](https://developer.apple.com/account/)
- A [Firebase](https://firebase.google.com/) project with Firestore & Storage enabled
- [Expo CLI](https://docs.expo.dev/get-started/installation/) installed globally

---

## 🌍 Environment Setup

Create a `.env` file in the root directory:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=your_jwt_secret                        # Used to sign JWT tokens
EXPO_PUBLIC_BASE_URL=your_base_url                # e.g., http://localhost:8081
EXPO_PUBLIC_SCHEME=your_app_scheme://             # Matches app.json scheme

# Generate yours at https://applekeygen.expo.app
APPLE_CLIENT_SECRET=your_apple_client_secret
```

> ⚠️ **Never commit your `.env` or `google-services.json` files.** They are already excluded via `.gitignore`.

---

## ▶️ Get Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the app:**

   ```bash
   npx expo start          # Start Expo dev server
   npx expo run:ios        # iOS Simulator
   npx expo run:android    # Android Emulator
   expo start --web        # Web browser
   ```

3. **Build for production:**

   ```bash
   eas build --platform ios --profile production
   eas build --platform android
   expo export --platform web -c   # Web export
   ```

---

## 📂 Project Structure

```
smartpeople/
├── app/                  # Expo Router screens & API routes
│   ├── api/              # BFF API routes (auth, token)
│   ├── chat/             # Chat, quiz, scoreboard, wallet screens
│   └── _layout.tsx       # Root layout & navigation
├── assets/               # Images, icons, sounds, notifications
├── components/           # Reusable UI components
├── constants/            # App-wide constants
├── context/              # Auth & global context providers
├── hooks/                # Custom React hooks
├── utils/                # Utility functions & middleware
└── public/               # Web service worker
```

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

1. Visit [Apple Key Generator](https://applekeygen.expo.app)
2. Enter your **Apple Developer Team ID** & **Bundle Identifier**
3. Generate and copy the **client secret**
4. Add it to your `.env` file

---

## 🔗 Tech Stack

| Layer         | Technology                  |
| ------------- | --------------------------- |
| Framework     | Expo (React Native)         |
| Navigation    | Expo Router                 |
| Database      | Firebase Firestore          |
| Storage       | Firebase Storage            |
| Auth          | Google OAuth, Apple Sign-In |
| AI            | Google Generative AI        |
| Blockchain    | Ethereum (ethers.js)        |
| Notifications | Expo Push Notifications     |
| Backend       | Node.js + Google Cloud Run  |
| Payments      | In-app credit system        |

---

## 📚 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [JWT.io](https://jwt.io/)
- [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)
- [ethers.js](https://docs.ethers.org/)

---

## 👥 Community & Support

- [Expo on GitHub](https://github.com/expo/expo)
- [Expo Discord](https://chat.expo.dev)

---

## 📄 License

Private & Proprietary — All rights reserved © Smart People App
