# 📱 Frontend Mobile App & Backend Updates

## 🎯 Context for AI Agent

The PostgreSQL database, Redis cache, Celery workers, and FastAPI backend are operational on `localhost:8001`. Your task is to update the backend booking limits, database seeding, and API validation to strictly match the new UI logic, and build the mobile app frontend using **React Native (Expo) with TypeScript**. 

**CRITICAL UPDATE:** Manual room selection has been removed. The frontend must no longer prompt the user to pick a room. The backend must automatically assign a room based on the requested time, session type, and AI acoustic checks.

## 🛠️ Backend Updates & Database Constraints (CRITICAL)

### 1. Daily Limits
Update the `POST /api/bookings` endpoint in `main.py` to change the daily user limit from 1 to 3.
* **Query:** `SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND booking_date = CURRENT_DATE AND status != 'Cancelled'`
* **Rule:** If `count >= 3`, return `400 Bad Request` (Daily limit of 3 bookings reached).

### 2. Database Seeding (Session Types & Rooms)
Ensure the `session_types` table includes exactly these options:
1. `Session A`
2. `Session B`
3. `Jam Session`
4. `Recording Session`
5. `Meeting Session` (New: No instruments required, standard booking).

### 3. API Auto-Assignment & Validation Logic (`POST /api/bookings`)
The frontend will no longer send a `room_id`. The backend MUST find an available room and enforce these rules before confirming the booking:

* **Auto-Room Assignment (NEW):** 
  * Query all rooms available for the requested date and time slot.
  * *Jam Pod Constraint:* If the user's requested practice mode is `Solo Practice`, the backend MUST filter out "Jam Pod" rooms from the available pool. Jam Pods cannot be assigned to solo practitioners.
  * Run the AI acoustic validation against the remaining available rooms. Assign the user to the first room that passes the acoustic threshold.

* **If `Session A` is requested:**
  * Valid Modes: `Solo Practice`, `Collaborative Jam`, `Full Band Rehearsal`.
  * *Session A Solo Policy:* If mode is `Solo Practice`, the `instruments` array MUST contain only ONE instrument: `Acoustic Drums` or `Electric Guitar`. Reject otherwise.
  * *Full Band Policy:* If mode is `Full Band Rehearsal`, bypass individual instrument checks ("All Instruments Included").

* **If `Session B` is requested:**
  * Valid Modes: `Solo Practice`, `Collaborative Jam`. (Do NOT allow Full Band Rehearsal).
  * *Session B Solo Policy:* If mode is `Solo Practice`, the `instruments` array MUST contain only ONE instrument.
  * *Session B Acoustic Policy:* The `instruments` array MUST NOT contain `Acoustic Drums` or `Electric Guitar`. Allowed instruments include Bass Guitar, Piano, Synthesizer/Keyboard, Vocals (Amplified), and Acoustic Guitar. Reject if violated.

* **If `Meeting Session` is requested:**
  * Bypass instrument validation completely. Assign to an available meeting-compatible space.

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
* *Note:* The "Book Now" button on this screen should launch a general booking flow, NOT a room-specific one.

## 🎸 Step 2: The Booking Wizard (Multi-Step Flow)

* **Step 2A: Session Type Selection (No Room Selection)**
  * The user directly selects a session type.
  * The dropdown for session must ONLY contain: `SESSION A`, `SESSION B`, `JAM SESSION`, `RECORDING SESSION`, and `MEETING SESSION`.

* **Step 2B: Practice Mode Selection (Strictly Filtered)**
  Based strictly on Step 2A (Session), render a dropdown for "Practice Mode":
  * *Session A:* Show `SOLO PRACTICE`, `COLLABORATIVE JAM`, `FULL BAND REHEARSAL`.
  * *Session B:* Show `SOLO PRACTICE`, `COLLABORATIVE JAM`.

* **Step 2C: Instrument Selection (Strictly Filtered)**
  * **All Solo Practice Modes (Session A & B):** Show a single-select dropdown for "Primary Instrument". **Do NOT show the multi-select grid or quantity steppers (no `- 0 +` buttons) for any Solo Practice.** The user can only select exactly one instrument.
  * **Session A (Solo):** Dropdown only contains `Acoustic Drums` and `Electric Guitar`.
  * **Session A (Collaborative Jam):** Show multi-select grid with quantity steppers for all instruments.
  * **Session A (Full Band):** Hide instrument selection entirely. Show banner: *"Single Band Booking Covers All Members. All Instruments Included."*
  * **Session B (Solo):** Dropdown only contains Bass Guitar, Piano, Synthesizer/Keyboard, Vocals (Amplified), and Acoustic Guitar. Display warning: *"Session B Acoustic Policy: Full band rehearsals, drums, and electric guitar are not permitted..."*
  * **Session B (Collaborative Jam):** Show multi-select grid with quantity steppers. Strictly hide `Acoustic Drums` and `Electric Guitar`.

* **Step 2D: Handling Auto-Assignment & AI Rejection**
  * The FastAPI backend will return a `200 OK` with the `assigned_room_id` if successful. UI should display: *"Booking Confirmed! You have been assigned to [Room Name]."*
  * If the backend cannot find any acoustically compatible room available, it returns `400 Bad Request`. UI must catch this and parse the `ai_acoustics.reason` to display a clear modal (e.g., *"No available rooms can handle the acoustic load of your selected instruments at this time."*)

## 🔔 Step 3: Push Notification Listeners
The Celery backend is sending FCM alerts at the 45-minute and 60-minute marks.
* Integrate `expo-notifications`.
* Request iOS/Android notification permissions on first launch.
* Save the device's FCM push token to the backend (`POST /api/users/push-token`).
* **Foreground Handling:** If the app is open when the 15-minute warning arrives, trigger an in-app banner or toast notification.