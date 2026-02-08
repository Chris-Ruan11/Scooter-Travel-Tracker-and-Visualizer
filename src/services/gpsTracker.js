import { Platform, AppState, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { addGPSPoint } from './database';

// Calculate distance between two GPS points (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

class GPSTracker {
  constructor() {
    this.currentTripId = null;
    this.isTracking = false;
    this.lastPoint = null;
    this.totalDistance = 0;
    this.points = [];
    this.maxSpeed = 0;
    this.onLocationUpdate = null;
    this.watchId = null;
    this.backgroundTimer = null;
    
    this.appState = AppState.currentState;
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      this.appState = nextAppState;
      console.log('App state changed to:', nextAppState);
    });
  }

  // Request location permissions
  async requestPermissions() {
    if (Platform.OS === 'ios') {
      // For iOS, just try to get position - it will auto-request permission
      try {
        await this.getCurrentPosition();
        return true;
      } catch (error) {
        console.error('Permission denied:', error);
        return false;
      }
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  }
  async startTracking(tripId, onLocationUpdate) {
    if (this.isTracking) {
      console.warn('Already tracking');
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    this.currentTripId = tripId;
    this.isTracking = true;
    this.lastPoint = null;
    this.totalDistance = 0;
    this.points = [];
    this.maxSpeed = 0;
    this.onLocationUpdate = onLocationUpdate;

    // Start watching position
    this.watchId = Geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => console.error('Location error:', error),
      {
        accuracy: {
          android: 'high',
          ios: 'best',
        },
        enableHighAccuracy: true,
        distanceFilter: 5, // Update every 5 meters
        interval: 5000, // 5 seconds
        fastestInterval: 3000, // Fastest 3 seconds
        showsBackgroundLocationIndicator: true, // iOS blue bar
        forceRequestLocation: true,
      }
    );

    console.log('GPS tracking started for trip', tripId);

    // For iOS background: Keep the app alive with periodic updates
    if (Platform.OS === 'ios') {
      this.startBackgroundPing();
    }
  }

  async handleLocationUpdate(position) {
    if (!this.isTracking) return;

    const point = {
      timestamp: position.timestamp || Date.now(),
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: position.coords.speed || 0,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude || 0,
    };

    // Filter out inaccurate points (>50m accuracy)
    if (point.accuracy > 50) {
      console.log('Inaccurate GPS point filtered out:', point.accuracy);
      return;
    }

    // Calculate distance from last point
    if (this.lastPoint) {
      const distance = calculateDistance(
        this.lastPoint.latitude,
        this.lastPoint.longitude,
        point.latitude,
        point.longitude
      );
      
      if (distance > 2) { // Ignore tiny movements
        this.totalDistance += distance;
      }
    }

    // Track max speed
    const speedMps = point.speed;
    if (speedMps > this.maxSpeed) {
      this.maxSpeed = speedMps;
    }

    // Save to database
    try {
      await addGPSPoint(this.currentTripId, point);
      this.points.push(point);
      this.lastPoint = point;

      // Callback for UI updates
      if (this.onLocationUpdate) {
        this.onLocationUpdate({
          point,
          totalDistance: this.totalDistance,
          maxSpeed: this.maxSpeed,
          pointCount: this.points.length,
        });
      }
    } catch (error) {
      console.error('Error saving GPS point:', error);
    }
  }

  // iOS background workaround
  startBackgroundPing() {
    this.backgroundTimer = setInterval(() => {
      if (this.isTracking) {
        // Get a single location update to keep tracking alive
        Geolocation.getCurrentPosition(
          (position) => {
            if (this.isTracking) {
              this.handleLocationUpdate(position);
            }
          },
          (error) => console.error('Background ping error:', error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }, 30000); // Ping every 30 seconds to keep tracking alive
  }

  async stopTracking() {
    if (!this.isTracking) return null;

    // Stop watching position
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Stop background timer
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }

    this.isTracking = false;

    const stats = {
      totalDistance: this.totalDistance,
      maxSpeed: this.maxSpeed,
      pointCount: this.points.length,
    };

    // Reset
    this.currentTripId = null;
    this.lastPoint = null;
    this.totalDistance = 0;
    this.points = [];
    this.maxSpeed = 0;

    console.log('GPS tracking stopped', stats);
    return stats;
  }

  // Get current position (for initial map centering)
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
            timestamp: position.timestamp,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }

  // Check permission status
  async checkPermissionStatus() {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.getAuthorizationStatus();
      // Convert to similar format as before
      switch (status) {
        case 'granted': return 4; // Always (or WhenInUse)
        case 'restricted': return 1;
        case 'denied': return 2;
        case 'whenInUse': return 3;
        default: return 0;
      }
    } else {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted ? 4 : 2;
    }
  }
}

// Singleton instance
const gpsTracker = new GPSTracker();
export default gpsTracker;