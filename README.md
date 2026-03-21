# VibeChat 🚀

VibeChat is a professional, high-performance real-time 1-to-1 chat application built with **React Native (Expo)**, **Node.js**, **Socket.io**, and **MongoDB Atlas**.

Designed for both **Mobile (Android/iOS)** and **Web**, VibeChat offers a premium, modern experience with a focus on security, speed, and rich media interaction.

---

## ✨ Features

### 🔐 Production-Grade Security
- **JWT Authentication**: Secure session management using Access & Refresh token rotation.
- **Brute-Force Protection**: Rate limiting on sensitive endpoints (Login, Register, Media).
- **Hardened Headers**: Integrated `Helmet` and strict CORS policies for web safety.
- **Data Integrity**: Global Zod validation for all incoming API and Socket data.

### 💬 Real-Time Messaging & Presence
- **Socket.io Powered**: Sub-100ms message delivery and real-time "Online/Offline" status.
- **Conversation Sync**: Automatically fetches missed messages and new chats upon login/refresh.
- **Delivery Tracking**: Visual indicators for `Sending`, `Sent`, and `Failed` message states.

### 🎨 Premium UI/UX (Glassmorphism)
- **Modern Aesthetics**: Sleek dark-mode interface with glassmorphism effects and custom Material Design 3 tokens.
- **Vibe IDs**: User-friendly alphanumeric identities (e.g., `VIBE-A1B2`) instead of long IDs.
- **Dynamic Bubbles**: Floating "Naked Media" layout for a clean, minimalist workspace.

### 📁 Advanced Media & Stickers
- **Sticker Studio**: Create and manage personal sticker libraries with auto-playing audio overlays.
- **High-Performance Assets**: Powered by **Cloudinary** for lightning-fast image and audio delivery.
- **Unified Controls**: Intelligent audio playback system ensuring only one sound plays at a time.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React Native (Expo SDK 49), React Navigation, Reanimated |
| **Backend** | Node.js (Express), Socket.io |
| **Database** | MongoDB Atlas (Mongoose) |
| **Storage** | Cloudinary (Images/Audio) |
| **Security** | JWT, BcryptJS, Helmet, Rate-Limit, Zod |
| **Logging** | Winston (Daily File Rotation) |

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas account
- Cloudinary account

### 2. Backend Setup
```bash
cd backend
npm install
# Configure your .env (see [.env.example](backend/.env.example))
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
# Configure your .env (EXPO_PUBLIC_API_URL)
npx expo start --web
```

---

## 📂 Project Structure

- `backend/`: API routes, Socket.io event logic, and production middlewares.
- `frontend/`: Multi-platform React Native components, services, and screens.
- `docs/`: (Optional) Additional architectural and walkthrough documents.

## 🕒 Changelog (Beta v1.1)

### 🎨 UI & UX Improvements
- **Message Bubble Fix**: Resolved "squished text" issue where bubbles would wrap words prematurely into squares.
- **Auto-Scroll**: Implemented intelligent auto-scrolling for `FlatList` when the keyboard opens or new messages arrive.
- **Sticker Success UI**: Replaced blocking alerts with a beautiful, non-blocking "Successfully Added!" checkmark overlay and auto-modal-close.

### 🚀 Performance & Caching
- **Sticker Caching**: Integrated `AsyncStorage` to cache sticker libraries locally for instant, network-less loading.
- **Optimized Autoplay**: Audio stickers now strictly autoplay **only** if they are the latest message in the chat and have not been played before on the current device.

### 🛠️ Bug Fixes & Backend Alignment
- **Cloudinary API Fix**: Re-routed media uploads through the secured backend `/media/upload` endpoint, resolving "Unknown API Key" errors and fixing unplayable audio recordings.
- **Sticker Creation Fix**: Corrected property mapping for Cloudinary response URLs, resolving "userId and mediaUrl are required" API errors.

---

## 📄 License
VibeChat is private software. See LICENSE for details.
