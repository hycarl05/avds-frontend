// services/SyncService.js
class SyncService {
    constructor() {
      this.callbacks = {
        create: [],
        update: [],
        delete: [],
        connection: [],
        error: []
      };
      this.echo = null;
      this.connected = false;
      this.lastEvent = null;
      this.initialized = false;
    }
  
    /**
     * Initialize the sync service with Echo instance
     * @param {Object} echo - Laravel Echo instance
     */
    init(echo) {
      try {
        if (!echo) {
          console.error('Echo instance is required to initialize SyncService');
          this.triggerCallbacks('error', { error: 'Echo instance missing' });
          return this;
        }
  
        this.echo = echo;
        
        // Safely check if Echo is properly initialized
        if (!this.echo.connector || !this.echo.connector.pusher) {
          console.warn('Echo initialized but Pusher connector not available');
          this.triggerCallbacks('error', { error: 'Pusher connector not available' });
          return this;
        }
        
        this.setupConnectionHandlers();
        this.listenToLocationEvents();
        
        this.initialized = true;
        console.log('📡 SyncService initialized successfully');
      } catch (error) {
        console.error('Failed to initialize SyncService:', error);
        this.triggerCallbacks('error', { error: error.message });
      }
      
      return this;
    }
  
    /**
     * Set up connection handlers with robust error checking
     */
    setupConnectionHandlers() {
      try {
        if (!this.echo?.connector?.pusher?.connection) {
          console.warn('Cannot set up connection handlers - Pusher connection not available');
          return;
        }
  
        // Connection state handlers
        this.echo.connector.pusher.connection.bind('connected', () => {
          console.log('✅ Real-time connection established');
          this.connected = true;
          this.triggerCallbacks('connection', { status: 'connected' });
        });
  
        this.echo.connector.pusher.connection.bind('disconnected', () => {
          console.log('⚠️ Real-time connection disconnected');
          this.connected = false;
          this.triggerCallbacks('connection', { status: 'disconnected' });
        });
  
        this.echo.connector.pusher.connection.bind('error', (err) => {
          console.error('❌ Real-time connection error:', err);
          this.connected = false;
          this.triggerCallbacks('error', { error: err });
        });
      } catch (error) {
        console.error('Error setting up connection handlers:', error);
      }
    }
  
    /**
     * Listen to location events with robust error checking
     */
    listenToLocationEvents() {
      try {
        if (!this.echo) {
          console.warn('Cannot listen to location events - Echo not available');
          return;
        }
  
        const handleCreated = (event) => {
          console.log('🆕 Location created event received:', event);
          this.lastEvent = { type: 'create', data: event, timestamp: new Date() };
          this.triggerCallbacks('create', event);
        };
        
        const handleUpdated = (event) => {
          console.log('🔄 Location updated event received:', event);
          this.lastEvent = { type: 'update', data: event, timestamp: new Date() };
          this.triggerCallbacks('update', event);
        };
        
        const handleDeleted = (event) => {
          console.log('🗑️ Location deleted event received:', event);
          this.lastEvent = { type: 'delete', data: event, timestamp: new Date() };
          this.triggerCallbacks('delete', event);
        };
        
        // Handle universal LocationUpdated event with action property
        const handleGenericUpdate = (event) => {
          console.log('🔔 Generic location event received:', event);
          
          if (!event || !event.action) {
            console.warn('Received event without action property:', event);
            return;
          }
          
          // Route to the appropriate handler based on action
          switch(event.action) {
            case 'created':
              handleCreated(event);
              break;
            case 'updated':
              handleUpdated(event);
              break;
            case 'deleted':
              handleDeleted(event);
              break;
            default:
              console.warn('Unknown action type:', event.action);
          }
        };
  
        // Try to listen to all possible event formats
        try {
          const locationsChannel = this.echo.channel('locations');
          
          // Format 1: With leading dot (Laravel standard)
          locationsChannel.listen('.location.created', handleCreated);
          locationsChannel.listen('.location.updated', handleUpdated);
          locationsChannel.listen('.location.deleted', handleDeleted);
          
          // Format 2: Without leading dot
          locationsChannel.listen('location.created', handleCreated);
          locationsChannel.listen('location.updated', handleUpdated);
          locationsChannel.listen('location.deleted', handleDeleted);
          
          // Format 3: Class name (Laravel broadcasts by class name)
          locationsChannel.listen('LocationCreated', handleCreated);
          locationsChannel.listen('LocationUpdated', handleGenericUpdate);
          locationsChannel.listen('LocationDeleted', handleDeleted);
          
          console.log('✅ Successfully registered all event listeners');
        } catch (channelError) {
          console.error('Failed to register location event listeners:', channelError);
        }
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }
  
    /**
     * Register a callback for a specific event type
     * @param {string} eventType - Event type ('create', 'update', 'delete', 'connection', 'error')
     * @param {Function} callback - Callback function
     */
    on(eventType, callback) {
      if (!this.callbacks[eventType]) {
        console.warn(`Unknown event type: ${eventType}`);
        return this;
      }
      
      this.callbacks[eventType].push(callback);
      return this; // For chaining
    }
  
    /**
     * Trigger all callbacks for a specific event type
     * @param {string} eventType - Event type
     * @param {any} data - Event data
     */
    triggerCallbacks(eventType, data) {
      if (!this.callbacks[eventType]) return;
      
      this.callbacks[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} callback:`, error);
        }
      });
    }
  
    /**
     * Get the connection status
     * @returns {boolean} - Connection status
     */
    isConnected() {
      return this.connected;
    }
  
    /**
     * Get initialization status
     * @returns {boolean} - Whether initialization is complete
     */
    isInitialized() {
      return this.initialized;
    }
  
    /**
     * Get the last received event
     * @returns {Object|null} - Last event
     */
    getLastEvent() {
      return this.lastEvent;
    }
  }
  
  // Export a singleton instance
  const syncService = new SyncService();
  export default syncService;
