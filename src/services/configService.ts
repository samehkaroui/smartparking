import { ParkingConfig } from '../types/parking';
import { API_CONFIG, buildApiUrl, apiRequest } from '../config/api';

export const configService = {
  async getParkingConfig(): Promise<ParkingConfig | null> {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.SETTINGS.PARKING_CONFIG);
      if (!response.ok) throw new Error('Failed to fetch config');
      return await response.json();
    } catch (error) {
      console.error('Error fetching parking config:', error);
      return null;
    }
  },

  async updateParkingConfig(config: Partial<ParkingConfig>): Promise<ParkingConfig> {
    const response = await apiRequest(API_CONFIG.ENDPOINTS.SETTINGS.PARKING_CONFIG, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to update config');
    return await response.json();
  }
};