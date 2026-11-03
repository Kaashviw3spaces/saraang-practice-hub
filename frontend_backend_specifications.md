# 📱 Frontend Mobile App & Backend Updates

## 🎯 Context for AI Agent
The PostgreSQL database, Redis cache, Celery workers, and FastAPI backend are operational on `localhost:8001`. Your task is to update the backend booking limits and build the mobile app frontend using **React Native (Expo) with TypeScript**. 

---

## 🛠️ Backend Update (CRITICAL)
Update the `POST /api/bookings` endpoint in `main.py` to change the daily user limit from 1 to 3.
- **Query:** `SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND booking_date = CURRENT_DATE AND status != 'Cancelled'`
- **Rule:** If `count >= 3`, return `400 Bad Request` (Daily limit of 3 bookings reached).

---

## 📁 Required Project Structure
Initialize the Expo project with the following structure:
```text
/frontend
 ├── /src
 │    ├── /api             # Axios/fetch clients communicating with FastAPI
 │    ├── /components      # Reusable UI (RoomCards, InstrumentChips)
 │    ├── /screens         # Main views (Dashboard, BookingFlow, Profile)
 │    ├── /store           # Global state management (Zustand or Redux)
 │    └── /utils           # Helpers
 ├── app.config.js         # Expo & FCM configuration
 └── package.json          
```

---

## 🚀 Step 1: The Live "Now Playing" Dashboard (Home Screen)
- **UI Layout:** A vertically scrolling list or grid of "Room Cards". 
- **Data Fetching:** Poll `GET /api/rooms/live` every 30 seconds OR establish a WebSocket connection.

---

## 🎸 Step 2: The Booking Wizard (Multi-Step Flow)

- **Step 2A: Session Type Selection (Match Design Spec)**
  Based on the reference UI from "Screenshot 2026-11-02 at 4.48.36 PM.jpg", present 4 primary booking cards with the exact text and constraints:

  1. **SESSION A**
     - *Description:* Rehearsal space with drums, drum pads and amplifiers.
     - *Tagline:* FULLY ISOLATED - SUITABLE FOR LOUD INSTRUMENTS AND FULL-BAND REHEARSALS.
     - *Capacity:* CAP: 8
  
  2. **SESSION B**
     - *Description:* Practice space ideal for solo practice, duets, and acoustic or electronic sessions.
     - *Tagline:* SEMI-ISOLATED - SUITABLE FOR MODERATELY LOUD PRACTICE SESSIONS TOGETHER.
     - *Capacity:* CAP: 6
  
  3. **JAM SESSION**
     - *Description:* Open jam space for collaborative sessions and small band rehearsals.
     - *Tagline:* ACOUSTIC PANELS - GOOD FOR ENSEMBLE PRACTICE.
     - *Capacity:* CAP: 8
  
  4. **RECORDING SESSION**
     - *Description:* Recording space for vocals and acoustic instruments.
     - *Tagline:* ISOLATED - PERFECT FOR FOCUSED RECORDING SESSIONS.
     - *Capacity:* CAP: 4

- **Step 2B: Instrument Selection (Pre-filtered by Session)**
  - Present a searchable grid of instruments, but **strictly filter the list** based on the Step 2A selection:
    - If `Session A` or `Jam Session`: UI displays loud instruments (e.g., Drums, Electric Guitar, Amplifiers).
    - If `Session B` or `Recording Session`: UI only displays low-decibel/acoustic instruments (e.g., Vocals, Bass, Acoustic Guitar, Keyboards).
  - *API Call:* Submit the payload to `POST /api/bookings`.

- **Step 2C: Handling the AI Rejection**
  - The FastAPI backend will return a `400 Bad Request` if the selected combination violates acoustic limits.
  - *UI Requirement:* Catch this 400 error. Do NOT just show "Booking Failed". Parse the `ai_acoustics.reason` from the JSON response and display a clear modal: *"Booking rejected by Acoustic AI: [Reason from backend]."*

---

## 🔔 Step 3: Push Notification Listeners
The Celery backend is sending FCM alerts at the 45-minute and 60-minute marks.

- Integrate `expo-notifications`.
- Request iOS/Android notification permissions on first launch.
- Save the device's FCM push token to the backend (`POST /api/users/push-token`).
- **Foreground Handling:** If the app is open when the 15-minute warning arrives, trigger an in-app banner or toast notification so the user does not miss it while looking at the screen.