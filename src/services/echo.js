// services/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Enable Pusher debug logging (remove in production)
Pusher.logToConsole = true;

// Safely make Pusher available globally (Laravel Echo needs this)
window.Pusher = Pusher;

let echo = null;

try {
  // Create Echo instance with more robust error handling
  echo = new Echo({
    broadcaster: 'pusher',
    key: '86048d07cdc0935892b4',
    cluster: 'ap1',
    forceTLS: true,
    enabledTransports: ['ws', 'wss'],
    // Add CSRF token if needed
    auth: {
      headers: {
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        'Accept': 'application/json'
      }
    },
    // Uncomment if your Laravel app requires authentication for broadcasting
    // authEndpoint: '/broadcasting/auth',
  });

  // Safely add connection event handlers
  if (echo.connector && echo.connector.pusher && echo.connector.pusher.connection) {
    echo.connector.pusher.connection.bind('connected', () => {
      console.log('✅ Pusher connected successfully with socket ID:', 
                  echo.connector.pusher.connection.socket_id);
    });

    echo.connector.pusher.connection.bind('connecting', () => {
      console.log('⏳ Pusher connecting...');
    });

    echo.connector.pusher.connection.bind('disconnected', () => {
      console.log('❌ Pusher disconnected');
    });

    echo.connector.pusher.connection.bind('error', (error) => {
      console.error('❌ Pusher connection error:', error);
    });
  } else {
    console.warn('Pusher connection not properly initialized');
  }

  console.log('Echo service initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Echo service:', error);
  // Create a fallback Echo object that won't crash your app
  echo = {
    channel: () => ({
      listen: () => ({})
    }),
    connector: { pusher: { connection: {} } },
    private: () => ({
      listen: () => ({})
    }),
    join: () => ({
      listen: () => ({})
    }),
    leave: () => {}
  };
}

export default echo;
