# 🎨 UI/UX Styling Directives (Text-Only Dark Mode Studio)

## ⚠️ Core Directive
DO NOT alter the backend booking logic. This specification is STRICTLY for the visual layer. The UI must replicate a minimalist "Dark Mode Studio" design system using horizontal scrolling carousels. **Crucially, DO NOT use any photographs, background images, or realistic graphics inside the cards.** Rely entirely on typography, spacing, and flat colors.

## 1. Strict Color Palette
- **App Background:** `#121212` (Deep Charcoal).
- **Card/Surface Base:** `#1E1E1E` (Surface Color).
- **Brand Accent:** `#5C1A1B` (Maroon Accent). Use this for active card backgrounds, borders, or selected states.
- **Primary Call-to-Action Buttons:** Solid White (`#FFFFFF`) background with bold, dark charcoal text (e.g., "Confirm Reservation").
- **Text:** Pure White (`#FFFFFF`) for primary headings, Light Grey (`#A0A0A0`) for secondary text, descriptions, and metadata.

## 2. Layout & Typography
- **Typography:** Use a clean, highly legible Sans-Serif font (like Inter, SF Pro, or Roboto). Use standard Title Case or Sentence Case for headings (e.g., "Select a Rehearsal Session"), avoiding the all-caps gamer look.
- **Horizontal Carousels:** Display selectable options (Session Types, Instruments) as horizontal scrolling rows of text-based cards.
- **Text-Only Card Design:**
  - Since there are no images, use a strong typographic hierarchy inside the flat `#1E1E1E` cards. 
  - Place the title (e.g., "Session A") at the top left in bold, followed by a pill-shaped tag for allowed modes (e.g., "Solo • Jam • Band"), and a brief grey text description at the bottom.
  - Give cards clean, rounded corners (approx. 12px) and ample internal padding (e.g., 16px to 24px) so they don't look empty without pictures.

## 3. Component Specifics
- **Selection State:** When a user selects a horizontal card, shift its background from `#1E1E1E` to a subtle `#5C1A1B` (Maroon) or add a thick maroon border, accompanied by a white checkmark icon.
- **Buttons & Inputs:** Keep action buttons thick and solid white. Date/Time inputs should be flat `#1E1E1E` boxes with subtle maroon outlines when focused.
- **Information Banners:** Warnings (like the Session B acoustic policy) should use a dark maroon background with high-contrast text, fitting seamlessly into the dark studio aesthetic.