import { ParkingSession } from '../types/parking';
import { API_CONFIG, buildApiUrl, apiRequest } from '../config/api';

export const parkingSessionService = {
  async getActiveSessions(): Promise<ParkingSession[]> {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.SESSIONS.ACTIVE);
      if (!response.ok) throw new Error('Failed to fetch active sessions');
      return await response.json();
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
  },

  subscribeToActiveSessions(callback: (sessions: ParkingSession[]) => void): () => void {
    // Implémentation WebSocket pour le temps réel
    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL || 'ws://localhost:3001'}/sessions`);
    
    ws.onopen = () => console.log('WebSocket connected for sessions');
    ws.onmessage = (event) => {
      try {
        const sessions = JSON.parse(event.data);
        callback(sessions);
      } catch (error) {
        console.error('Error parsing session data:', error);
      }
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket disconnected for sessions');

    return () => ws.close();
  },

  async createSession(sessionData: Omit<ParkingSession, '_id' | 'createdAt' | 'updatedAt'>): Promise<ParkingSession> {
    const response = await apiRequest(API_CONFIG.ENDPOINTS.SESSIONS.BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });
    if (!response.ok) throw new Error('Failed to create session');
    return await response.json();
  },

  async endSession(sessionId: string): Promise<ParkingSession> {
    const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SESSIONS.END(sessionId)), {
      method: 'PUT'
    });
    if (!response.ok) throw new Error('Failed to end session');
    return await response.json();
  }
};