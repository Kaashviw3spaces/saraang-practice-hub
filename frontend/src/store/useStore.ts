import { create } from 'zustand';
import { LiveSession, SessionType, Instrument, BookingResponse, AcousticCheckResponse } from '../api/client';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  timestamp: string;
}

export interface BookingWizardState {
  step: 1 | 2 | 3;
  selectedSession: SessionType | null;
  practiceMode: string;
  meetingContext: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;   // HH:MM:00
  durationMinutes: number; // 60 or 120
  participantCount: number;
  instruments: Record<number, number>; // instrumentId -> quantity
  acousticPreview: AcousticCheckResponse | null;
  isCheckingAcoustics: boolean;
  rejectionModal: {
    isOpen: boolean;
    reason: string;
    details?: any;
  };
}

interface AppState {
  // Current Authenticated User
  currentUser: {
    id: number;
    name: string;
    email: string;
  };
  setCurrentUser: (user: { id: number; name: string; email: string }) => void;

  // Live Telemetry (Categorised strictly by Sessions)
  liveSessions: LiveSession[];
  setLiveSessions: (sessions: LiveSession[]) => void;
  isLoadingLiveSessions: boolean;
  setIsLoadingLiveSessions: (loading: boolean) => void;

  // Catalogues
  sessionTypes: SessionType[];
  setSessionTypes: (types: SessionType[]) => void;
  instruments: Instrument[];
  setInstruments: (instruments: Instrument[]) => void;

  // User Bookings
  userBookings: BookingResponse[];
  setUserBookings: (bookings: BookingResponse[]) => void;
  isLoadingBookings: boolean;
  setIsLoadingBookings: (loading: boolean) => void;

  // Booking Wizard
  wizard: BookingWizardState;
  setWizardStep: (step: 1 | 2 | 3) => void;
  selectSession: (session: SessionType) => void;
  setPracticeMode: (mode: string) => void;
  setMeetingContext: (context: string) => void;
  setBookingDateTime: (date: string, time: string, duration: number) => void;
  setParticipantCount: (count: number) => void;
  setInstrumentQuantity: (instrumentId: number, qty: number) => void;
  setAcousticPreview: (preview: AcousticCheckResponse | null) => void;
  setIsCheckingAcoustics: (checking: boolean) => void;
  openRejectionModal: (reason: string, details?: any) => void;
  closeRejectionModal: () => void;
  resetWizard: () => void;

  // Notifications
  activeNotification: InAppNotification | null;
  showNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void;
  dismissNotification: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: {
    id: 3,
    name: 'Aarav Sharma',
    email: 'aarav@musicclub.org',
  },
  setCurrentUser: (user) => set({ currentUser: user }),

  liveSessions: [],
  setLiveSessions: (sessions) => set({ liveSessions: sessions }),
  isLoadingLiveSessions: false,
  setIsLoadingLiveSessions: (loading) => set({ isLoadingLiveSessions: loading }),

  sessionTypes: [],
  setSessionTypes: (sessionTypes) => set({ sessionTypes }),
  instruments: [],
  setInstruments: (instruments) => set({ instruments }),

  userBookings: [],
  setUserBookings: (userBookings) => set({ userBookings }),
  isLoadingBookings: false,
  setIsLoadingBookings: (loading) => set({ isLoadingBookings: loading }),

  wizard: {
    step: 1,
    selectedSession: null,
    practiceMode: 'Solo Practice',
    meetingContext: '',
    bookingDate: new Date().toISOString().split('T')[0],
    startTime: '16:00:00',
    durationMinutes: 60,
    participantCount: 2,
    instruments: {},
    acousticPreview: null,
    isCheckingAcoustics: false,
    rejectionModal: {
      isOpen: false,
      reason: '',
    },
  },

  setWizardStep: (step) =>
    set((state) => ({ wizard: { ...state.wizard, step } })),

  selectSession: (session) => {
    const sName = (session.name || '').toLowerCase();
    const defaultMode = sName.includes('session b')
      ? 'Collaborative Practice'
      : sName.includes('jam')
      ? 'Collaborative Practice'
      : sName.includes('recording')
      ? 'Solo Recording'
      : sName.includes('meeting')
      ? 'Meeting'
      : 'Solo Practice';

    const defaultParticipants = sName.includes('meeting') ? 2 : 1;

    set((state) => ({
      wizard: {
        ...state.wizard,
        selectedSession: session,
        practiceMode: defaultMode,
        meetingContext: '',
        participantCount: defaultParticipants,
        step: 2,
        // Reset instruments on session change to guarantee filter compliance
        instruments: {},
        acousticPreview: null,
      },
    }));
  },

  setPracticeMode: (practiceMode) =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        practiceMode,
        participantCount: practiceMode.toLowerCase() === 'full band rehearsal' ? 4 : 1,
        // Reset instruments when mode changes
        instruments: {},
        acousticPreview: null,
      },
    })),

  setMeetingContext: (meetingContext) =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        meetingContext,
      },
    })),

  setBookingDateTime: (date, time, duration) =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        bookingDate: date,
        startTime: time,
        durationMinutes: duration,
      },
    })),

  setParticipantCount: (count) =>
    set((state) => ({
      wizard: { ...state.wizard, participantCount: count },
    })),

  setInstrumentQuantity: (instrumentId, qty) =>
    set((state) => {
      const updated = { ...state.wizard.instruments };
      if (qty <= 0) {
        delete updated[instrumentId];
      } else {
        updated[instrumentId] = qty;
      }
      return { wizard: { ...state.wizard, instruments: updated } };
    }),

  setAcousticPreview: (preview) =>
    set((state) => ({ wizard: { ...state.wizard, acousticPreview: preview } })),

  setIsCheckingAcoustics: (checking) =>
    set((state) => ({ wizard: { ...state.wizard, isCheckingAcoustics: checking } })),

  openRejectionModal: (reason, details) =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        rejectionModal: { isOpen: true, reason, details },
      },
    })),

  closeRejectionModal: () =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        rejectionModal: { isOpen: false, reason: '', details: undefined },
      },
    })),

  resetWizard: () =>
    set((state) => ({
      wizard: {
        step: 1,
        selectedSession: null,
        practiceMode: 'Solo Practice',
        meetingContext: '',
        bookingDate: new Date().toISOString().split('T')[0],
        startTime: '16:00:00',
        durationMinutes: 60,
        participantCount: 2,
        instruments: {},
        acousticPreview: null,
        isCheckingAcoustics: false,
        rejectionModal: { isOpen: false, reason: '' },
      },
    })),

  activeNotification: null,
  showNotification: (notification) =>
    set({
      activeNotification: {
        ...notification,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
      },
    }),
  dismissNotification: () => set({ activeNotification: null }),
}));
