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
    
    this.tripStarted = false; // Has trip actually started (reached speed threshold)?
    this.speedBuffer = []; // Buffer to check sustained speed
    this.pointsBeforeStart = []; // Points collected before trip "starts"
    this.actualStartTime = null; // When trip actually started
    
    this.START_SPEED_THRESHOLD = 2.5; // m/s (~5.6 mph) - need to reach this to "start"
    this.END_SPEED_THRESHOLD = 2.0; // m/s (~4.5 mph) - below this at end gets trimmed
    this.SPEED_BUFFER_SIZE = 3; // Need 3 consecutive readings (~15 sec total)
    
    this.appState = AppState.currentState;
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      this.appState = nextAppState;
      console.log('App state changed to:', nextAppState);
    });
  }

  // Request location permissions
  async requestPermissions() {
    if (Platform.OS === 'ios') {
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
    
    this.tripStarted = false;
    this.speedBuffer = [];
    this.pointsBeforeStart = [];
    this.actualStartTime = null;

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
        showsBackgroundLocationIndicator: true,
        forceRequestLocation: true,
      }
    );

    console.log('🛴 GPS tracking started for trip', tripId);
    console.log('⏳ Waiting for speed to reach ~5.6 mph to start recording...');

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

    const speedMps = point.speed;

    if (!this.tripStarted) {
      this.speedBuffer.push(speedMps);
      this.pointsBeforeStart.push(point);

      // Keep buffer at max size
      if (this.speedBuffer.length > this.SPEED_BUFFER_SIZE) {
        this.speedBuffer.shift();
        // Only keep last 10 points before start for smooth route
        if (this.pointsBeforeStart.length > 10) {
          this.pointsBeforeStart.shift();
        }
      }

      // Check if we've reached start speed threshold consistently
      const avgSpeed = this.speedBuffer.reduce((a, b) => a + b, 0) / this.speedBuffer.length;

      if (this.speedBuffer.length >= this.SPEED_BUFFER_SIZE && avgSpeed >= this.START_SPEED_THRESHOLD) {
        // TRIP STARTS
        this.tripStarted = true;
        this.actualStartTime = Date.now();
        console.log('✅ Trip started! Average speed:', (avgSpeed * 2.237).toFixed(1), 'mph');

        // Save the buffered points (last few points before we started)
        for (const bufferedPoint of this.pointsBeforeStart) {
          await this.savePoint(bufferedPoint);
        }
        this.pointsBeforeStart = [];
      } else {
        // Still waiting, update UI with "waiting" state
        if (this.onLocationUpdate) {
          this.onLocationUpdate({
            point,
            totalDistance: 0,
            maxSpeed: 0,
            pointCount: 0,
            waiting: true, 
            currentSpeed: speedMps * 2.237
          });
        }
      }
      return;
    }

    if (this.tripStarted) {
      await this.savePoint(point);
    }
  }

  async savePoint(point) {
    const speedMps = point.speed;

    // Calculate distance from last point
    if (this.lastPoint) {
      const distance = calculateDistance(
        this.lastPoint.latitude,
        this.lastPoint.longitude,
        point.latitude,
        point.longitude
      );

      if (distance > 2) { // Ignore tiny movements (GPS drift)
        this.totalDistance += distance;
      }
    }

    // Track max speed
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
          waiting: false,
          currentSpeed: speedMps * 2.237
        });
      }
    } catch (error) {
      console.error('Error saving GPS point:', error);
    }
  }

  startBackgroundPing() {
    this.backgroundTimer = setInterval(() => {
      if (this.isTracking) {
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
    }, 30000);
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

    // End trimming
    let trimmedPoints = [...this.points];
    let trimmedDistance = this.totalDistance;

    while (trimmedPoints.length > 0) {
      const lastPoint = trimmedPoints[trimmedPoints.length - 1];
      const lastSpeed = lastPoint.speed || 0;

      // If last point is fast enough, we're done trimming
      if (lastSpeed >= this.END_SPEED_THRESHOLD) {
        break;
      }

      const removedPoint = trimmedPoints.pop();

      // Recalculate distance without this point
      if (trimmedPoints.length > 0) {
        const prevPoint = trimmedPoints[trimmedPoints.length - 1];
        const removedDistance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          removedPoint.latitude,
          removedPoint.longitude
        );
        trimmedDistance -= removedDistance;
      }
    }

    const pointsRemoved = this.points.length - trimmedPoints.length;

    if (pointsRemoved > 0) {
      console.log(`🎯 Trimmed ${pointsRemoved} slow points from end of trip`);
      console.log(`Distance before: ${this.totalDistance.toFixed(0)}m, after: ${trimmedDistance.toFixed(0)}m`);
    }

    const stats = {
      totalDistance: trimmedDistance,
      maxSpeed: this.maxSpeed,
      pointCount: trimmedPoints.length,
      actualStartTime: this.actualStartTime, // When trip actually started (reached speed threshold)
      actualEndTime: trimmedPoints.length > 0 ? trimmedPoints[trimmedPoints.length - 1].timestamp : Date.now(), 
    };

    this.currentTripId = null;
    this.lastPoint = null;
    this.totalDistance = 0;
    this.points = [];
    this.maxSpeed = 0;
    this.tripStarted = false;
    this.speedBuffer = [];
    this.pointsBeforeStart = [];

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
      switch (status) {
        case 'granted': return 4;
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