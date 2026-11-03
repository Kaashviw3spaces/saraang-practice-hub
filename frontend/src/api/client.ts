import axios from 'axios';
import { Platform } from 'react-native';

// Fallback host URL: on Android emulator, 10.0.2.2 is localhost; on iOS simulator or Web, localhost works
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8001';
  }
  return 'http://localhost:8001';
};

export const API_BASE_URL = getBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface LiveRoom {
  id: number;
  name: string;
  base_capacity: number;
  max_decibel_threshold: number;
  echo_factor: number;
  status: 'Available' | 'Occupied';
  is_occupied: boolean;
  current_decibels: number;
  current_session: {
    booking_id?: number;
    session_type: string;
    user_name: string;
    start_time: string;
    end_time: string;
    participant_count: number;
    effective_decibels: number;
    instruments?: Array<{ id: number; name: string; quantity: number }>;
  } | null;
}

export interface SessionType {
  id: number;
  name: string;
  participant_limit: number;
  is_strict_lockdown: boolean;
  description?: string;
  tagline?: string;
}

export interface Instrument {
  id: number;
  name: string;
  category: string;
  base_decibels: number;
  frequency_band: string;
}

export interface AcousticCheckRequest {
  room_id: number;
  session_type_id: number;
  instruments: Array<{ instrument_id: number; quantity: number }>;
}

export interface AcousticCheckResponse {
  compatible: boolean;
  total_decibels: number;
  effective_decibels: number;
  max_allowed_decibels: number;
  echo_factor: number;
  is_strict_lockdown: boolean;
  frequency_band_distribution: Record<string, number>;
  frequency_collisions: string[];
  warnings: string[];
  rejection_reasons: string[];
}

export interface CreateBookingRequest {
  user_id: number;
  room_id: number;
  session_type_id: number;
  booking_date: string; // YYYY-MM-DD
  start_time: string;   // HH:MM:SS
  end_time: string;     // HH:MM:SS
  participant_count: number;
  instruments: Array<{ instrument_id: number; quantity: number }>;
}

export interface BookingResponse {
  id: number;
  user_id: number;
  user_name: string;
  room_id: number;
  room_name: string;
  session_type_id: number;
  session_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  participant_count: number;
  status: 'Confirmed' | 'Cancelled' | 'Completed';
  created_at: string;
  instruments: any[];
}

export const api = {
  getLiveRooms: async () => {
    const res = await apiClient.get<{ rooms: LiveRoom[]; timestamp: string }>('/api/rooms/live');
    return res.data.rooms;
  },

  getSessionTypes: async () => {
    const res = await apiClient.get<SessionType[]>('/api/session-types');
    return res.data;
  },

  getInstruments: async () => {
    const res = await apiClient.get<Instrument[]>('/api/instruments');
    return res.data;
  },

  checkAcoustics: async (payload: AcousticCheckRequest) => {
    const res = await apiClient.post<AcousticCheckResponse>('/api/bookings/acoustic-check', payload);
    return res.data;
  },

  createBooking: async (payload: CreateBookingRequest) => {
    const res = await apiClient.post<BookingResponse>('/api/bookings', payload);
    return res.data;
  },

  getUserBookings: async (userId: number) => {
    const res = await apiClient.get<BookingResponse[]>(`/api/bookings?user_id=${userId}`);
    return res.data;
  },

  cancelBooking: async (bookingId: number) => {
    const res = await apiClient.post<{ status: string; message: string }>(`/api/bookings/${bookingId}/cancel`);
    return res.data;
  },

  registerPushToken: async (userId: number, pushToken: string) => {
    const res = await apiClient.post('/api/users/push-token', {
      user_id: userId,
      push_token: pushToken,
      platform: Platform.OS,
    });
    return res.data;
  },

  getNowPlaying: async () => {
    const res = await apiClient.get('/api/dashboard/now-playing');
    return res.data;
  },
};
