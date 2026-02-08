import {  Linking } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import gpsTracker from '../services/gpsTracker';
import { createTrip, updateTrip } from '../services/database';
import {
  metersToMiles,
  formatDistance,
  formatDuration,
  calculateCostSavings,
  calculateTimeSaved,
  calculateAvgSpeed,
  mpsToMph
} from '../utils/calculations';

const TrackingScreen = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [tripStats, setTripStats] = useState({
    distance: 0,
    duration: 0,
    maxSpeed: 0
  });

  const mapRef = useRef(null);
  const startTime = useRef(null);
  const timerInterval = useRef(null);

  useEffect(() => {
    getCurrentLocation();

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      const position = await gpsTracker.getCurrentPosition();
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const requestBackgroundPermission = async () => {
    // Permission will be requested automatically when GPS starts
    return true;
  };

  const handleStartTrip = async () => {
    try {
      const hasPermission = await requestBackgroundPermission();
      if (!hasPermission) {
        return;
      }

      const now = Date.now();
      const tripId = await createTrip(now);
      
      setCurrentTripId(tripId);
      setIsTracking(true);
      startTime.current = now;
      setRouteCoordinates([]);
      setTripStats({ distance: 0, duration: 0, maxSpeed: 0 });

      // Start GPS tracking (will request "Always" permission if needed)
      await gpsTracker.startTracking(tripId, handleLocationUpdate);

      // Start timer for duration
      timerInterval.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTime.current) / 1000);
        setTripStats(prev => ({ ...prev, duration }));
      }, 1000);

      // Show info about background tracking
      Alert.alert(
        'Tracking Started',
        'Your ride is being tracked. You can lock your phone - tracking will continue in the background!',
        [{ text: 'Got it!' }]
      );

    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip: ' + error.message);
    }
  };

  const handleLocationUpdate = ({ point, totalDistance, maxSpeed }) => {
    const newCoord = {
      latitude: point.latitude,
      longitude: point.longitude
    };

    setCurrentLocation(newCoord);
    setRouteCoordinates(prev => [...prev, newCoord]);
    setTripStats(prev => ({
      ...prev,
      distance: totalDistance,
      maxSpeed: mpsToMph(maxSpeed)
    }));

    // Center map on current location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...newCoord,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      }, 1000);
    }
  };

  const handleStopTrip = async () => {
    try {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }

      const stats = await gpsTracker.stopTracking();
      
      if (!stats) {
        Alert.alert('Error', 'Failed to stop tracking');
        return;
      }

      const endTime = Date.now();
      const duration = Math.floor((endTime - startTime.current) / 1000);
      const distanceMiles = metersToMiles(stats.totalDistance);
      const avgSpeed = calculateAvgSpeed(stats.totalDistance, duration);
      const costSaved = calculateCostSavings(distanceMiles);
      const timeSaved = calculateTimeSaved(distanceMiles, duration);

      await updateTrip(currentTripId, {
        end_time: endTime,
        distance: stats.totalDistance,
        duration: duration,
        avg_speed: avgSpeed,
        max_speed: mpsToMph(stats.maxSpeed),
        cost_saved: costSaved,
        time_saved: timeSaved
      });

      setIsTracking(false);
      setCurrentTripId(null);
      
      Alert.alert(
        'Trip Completed! 🛴',
        `Distance: ${formatDistance(distanceMiles)}\n` +
        `Duration: ${formatDuration(duration)}\n` +
        `Avg Speed: ${avgSpeed.toFixed(1)} mph\n` +
        `Cost Saved: $${costSaved.toFixed(2)}\n` +
        `Time Saved: ${formatDuration(timeSaved)}`,
        [
          { text: 'OK', onPress: () => navigation.navigate('History') }
        ]
      );

    } catch (error) {
      console.error('Error stopping trip:', error);
      Alert.alert('Error', 'Failed to stop trip: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || 37.78825,
          longitude: currentLocation?.longitude || -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4A90E2"
            strokeWidth={4}
          />
        )}
        
        {routeCoordinates.length > 0 && (
          <>
            <Marker
              coordinate={routeCoordinates[0]}
              pinColor="green"
              title="Start"
            />
            <Marker
              coordinate={routeCoordinates[routeCoordinates.length - 1]}
              pinColor="red"
              title="Current"
            />
          </>
        )}
      </MapView>

      <View style={styles.statsContainer}>
        {isTracking && (
          <>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>
                {formatDistance(metersToMiles(tripStats.distance))}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {formatDuration(tripStats.duration)}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Max Speed</Text>
              <Text style={styles.statValue}>
                {tripStats.maxSpeed.toFixed(1)} mph
              </Text>
            </View>
          </>
        )}
      </View>

      {isTracking && (
        <View style={styles.backgroundNotice}>
          <Text style={styles.backgroundNoticeText}>
            📍 Background tracking active
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={handleStartTrip}
          >
            <Text style={styles.buttonText}>Start Scoot 🛴</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={handleStopTrip}
          >
            <Text style={styles.buttonText}>Stop Scoot</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 100,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  backgroundNotice: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.9)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  backgroundNoticeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  button: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TrackingScreen;
