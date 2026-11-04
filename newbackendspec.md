# 📱 Frontend Mobile App & Backend Updates

## 🎯 Context for AI Agent

The PostgreSQL database, Redis cache, Celery workers, and FastAPI backend are operational on `localhost:8001`. Your task is to update the backend booking limits, database seeding, and API validation to strictly match the new UI logic, and build the mobile app frontend using **React Native (Expo) with TypeScript**.

## 🛠️ Backend Updates & Database Constraints (CRITICAL)

### 1. Daily Limits
Update the `POST /api/bookings` endpoint in `main.py` to change the daily user limit from 1 to 3.
* **Query:** `SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND booking_date = CURRENT_DATE AND status != 'Cancelled'`
* **Rule:** If `count >= 3`, return `400 Bad Request` (Daily limit of 3 bookings reached).

### 2. Database Seeding (Session Types)
Ensure the `session_types` table includes exactly these options:
1. `Session A`
2. `Session B`
3. `Jam Session`
4. `Recording Session`
5. `Meeting Session` (New: No instruments required, standard room booking).

### 3. API Validation Logic (`POST /api/bookings`)
The backend MUST strictly enforce the practice modes and instrument rules shown in the UI before allowing a booking:

* **If `Session A` is selected:**
  * Valid Modes: `Solo Practice`, `Collaborative Jam`, `Full Band Rehearsal`.
  * *Session A Solo Policy:* If mode is `Solo Practice`, the `instruments` array MUST contain only `Acoustic Drums` or `Electric Guitar`. Reject otherwise.
  * *Full Band Policy:* If mode is `Full Band Rehearsal`, bypass individual instrument checks ("All Instruments Included").

* **If `Session B` is selected:**
  * Valid Modes: `Solo Practice`, `Collaborative Jam`. (Do NOT allow Full Band Rehearsal).
  * *Session B Acoustic Policy:* The `instruments` array MUST NOT contain `Acoustic Drums` or `Electric Guitar`. Allowed instruments include Bass Guitar, Piano, Synthesizer/Keyboard, Vocals (Amplified), and Acoustic Guitar. Reject if violated.

* **If `Meeting Session` is selected:**
  * Bypass instrument validation completely.

## 📁 Required Project Structure

Initialize the Expo project with the following structure:

```text
/frontend
 ├── /src
 │    ├── /api             # Axios/fetch clients communicating with FastAPI
 │    ├── /components      # Reusable UI (RoomCards, InstrumentChips, Dropdowns)
 │    ├── /screens         # Main views (Dashboard, BookingFlow, Profile)
 │    ├── /store           # Global state management (Zustand or Redux)
 │    └── /utils           # Helpers
 ├── app.config.js         # Expo & FCM configuration
 └── package.json          
```

## 🚀 Step 1: The Live "Now Playing" Dashboard (Home Screen)

* **UI Layout:** A vertically scrolling list or grid of "Room Cards".
* **Data Fetching:** Poll `GET /api/rooms/live` every 30 seconds OR establish a WebSocket connection.

## 🎸 Step 2: The Booking Wizard (Multi-Step Flow)

* **Step 2A: Session Type Selection (Strict UI Match)**
  The first dropdown must ONLY contain: `SESSION A`, `SESSION B`, `JAM SESSION`, `RECORDING SESSION`, and `MEETING SESSION`.

* **Step 2B: Practice Mode Selection**
  Based on Step 2A, render a second dropdown for "Practice Mode":
  * *Session A:* Show `SOLO PRACTICE`, `COLLABORATIVE JAM`, `FULL BAND REHEARSAL`.
  * *Session B:* Show `SOLO PRACTICE`, `COLLABORATIVE JAM`.

* **Step 2C: Instrument Selection (Strictly Filtered)**
  * **Session A (Solo):** Show dropdown for Primary Instrument with ONLY `Acoustic Drums` and `Electric Guitar`.
  * **Session A (Collaborative Jam):** Show multi-select grid with all instruments.
  * **Session A (Full Band):** Hide instrument selection entirely. Show banner: *"Single Band Booking Covers All Members. All Instruments Included."*
  * **Session B:** Show instrument selection but strictly hide `Acoustic Drums` and `Electric Guitar`. Display warning: *"Session B Acoustic Policy: Full band rehearsals, drums, and electric guitar are not permitted..."*

* **Step 2D: Handling the AI Rejection**
  * The FastAPI backend will return a `400 Bad Request` if the selected combination violates the above backend acoustic limits.
  * *UI Requirement:* Catch this 400 error. Do NOT just show "Booking Failed". Parse the `ai_acoustics.reason` from the JSON response and display a clear modal.

## 🔔 Step 3: Push Notification Listeners

The Celery backend is sending FCM alerts at the 45-minute and 60-minute marks.

* Integrate `expo-notifications`.
* Request iOS/Android notification permissions on first launch.
* Save the device's FCM push token to the backend (`POST /api/users/push-token`).
* **Foreground Handling:** If the app is open when the 15-minute warning arrives, trigger an in-app banner or toast notification.