// Centralized API configuration
export const API_CONFIG = {
  // Use Vercel API in production, local server in development
  BASE_URL: window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')
    ? '/api' 
    : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api'),
  
  // Endpoints
  ENDPOINTS: {
    // Authentication
    AUTH: {
      LOGIN: '/auth/login',
      VERIFY: '/auth/verify',
      REGISTER: '/auth/register'
    },
    
    // Users
    USERS: {
      BASE: '/users',
      BY_ID: (id: string) => `/users/${id}`,
    },
    
    // Sessions
    SESSIONS: {
      BASE: '/sessions',
      BY_ID: (id: string) => `/sessions/${id}`,
      ACTIVE: '/sessions/active',
      END: (id: string) => `/sessions/${id}/end`,
      PAY: (id: string) => `/sessions/${id}/pay`
    },
    
    // Payments
    PAYMENTS: {
      BASE: '/payments',
      REPORTS: '/payments/reports',
      STATS: '/payments/stats',
      HEALTH: '/payments/health'
    },
    
    // Parking
    PARKING: {
      SPACES: '/parking/spaces',
      SPACE_BY_NUMBER: (number: string) => `/parking/spaces/${number}`,
      RESERVE: '/parking/reserve',
      OCCUPY: '/parking/occupy',
      FREE: '/parking/free',
      CANCEL_RESERVATION: '/parking/cancel-reservation',
      OUT_OF_SERVICE: '/parking/out-of-service',
      IN_SERVICE: '/parking/in-service',
      HISTORY: '/parking/history',
      HISTORY_BY_SPACE: (spaceNumber: string) => `/parking/history/${spaceNumber}`,
      GENERATE: '/parking/generate',
      GENERATE_SPACES: '/parking/generate-spaces',
      CLEANUP_EXPIRED: '/parking/cleanup-expired'
    },
    
    // Notifications
    NOTIFICATIONS: {
      BASE: '/notifications',
      BY_ID: (id: string) => `/notifications/${id}`,
      MARK_READ: (id: string) => `/notifications/${id}/read`,
      UNREAD: '/notifications/unread'
    },
    
    // Transactions
    TRANSACTIONS: {
      BASE: '/transactions'
    },
    
    // Alerts
    ALERTS: {
      BASE: '/alerts',
      MARK_READ: (id: string) => `/alerts/${id}/read`
    },
    
    // Settings/Config
    SETTINGS: {
      BASE: '/settings',
      PARKING_CONFIG: '/config/parking'
    },
    
    // Reports
    REPORTS: {
      PDF: '/reports/pdf',
      CSV: '/reports/csv'
    },
    
    // Stats
    STATS: '/stats',
    HEALTH: '/health'
  }
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function for fetch with error handling
export const apiRequest = async (endpoint: string, options?: RequestInit) => {
  const url = buildApiUrl(endpoint);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
};
