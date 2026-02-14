import { Linking } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import gpsTracker from '../services/gpsTracker';
import { createTrip, updateTrip, deleteTrip } from '../services/database';
import {
  metersToMiles,
  formatDistance,
  formatDuration,
  calculateBirdCost,
  calculateTimeSaved,
  calculateTimeSavingsValue,
  calculateAvgSpeed,
  mpsToMph,
  formatCurrency
} from '../utils/calculations';
import Confetti from '../components/Confetti';

const TrackingScreen = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [tripStats, setTripStats] = useState({
    distance: 0,
    duration: 0,
    maxSpeed: 0,
    waiting: false
  });
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [completedTripStats, setCompletedTripStats] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const mapRef = useRef(null);
  const startTime = useRef(null);
  const timerInterval = useRef(null);

  useEffect(() => {
    if (gpsTracker.isTracking) {
      gpsTracker.stopTracking();
    }
    
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
      setTripStats({ distance: 0, duration: 0, maxSpeed: 0, waiting: true });

      // Start GPS tracking
      await gpsTracker.startTracking(tripId, handleLocationUpdate);

      // Start timer for duration
      timerInterval.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTime.current) / 1000);
        setTripStats(prev => ({ ...prev, duration }));
      }, 1000);

    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip: ' + error.message);
    }
  };

  const handleLocationUpdate = ({ point, totalDistance, maxSpeed, waiting }) => {
    const newCoord = {
      latitude: point.latitude,
      longitude: point.longitude
    };

    setCurrentLocation(newCoord);

    if (!waiting) {
      setRouteCoordinates(prev => [...prev, newCoord]);
    }

    setTripStats(prev => ({
      ...prev,
      distance: totalDistance,
      maxSpeed: mpsToMph(maxSpeed),
      waiting: waiting || false
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

      const duration = Math.floor((stats.actualEndTime - stats.actualStartTime) / 1000);
      const distanceMiles = metersToMiles(stats.totalDistance);
      const distanceFeet = distanceMiles * 5280;

      // Check if trip is less than 100 feet
      if (distanceFeet < 100) {
        // Delete the trip
        await deleteTrip(currentTripId);

        setIsTracking(false);
        setCurrentTripId(null);
        setRouteCoordinates([]);

        Alert.alert(
          'Trip Too Short',
          `Your trip was only ${distanceFeet.toFixed(0)} feet. Trips under 100 feet are not saved.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Calculate all the stats
      const avgSpeed = calculateAvgSpeed(stats.totalDistance, duration);
      const birdCost = calculateBirdCost(duration);
      const timeSaved = calculateTimeSaved(distanceMiles, duration);
      const timeValue = calculateTimeSavingsValue(timeSaved);

      // Save the trip
      await updateTrip(currentTripId, {
        end_time: stats.actualEndTime,
        distance: stats.totalDistance,
        duration: duration,
        avg_speed: avgSpeed,
        max_speed: mpsToMph(stats.maxSpeed),
        cost_saved: birdCost,
        time_saved: timeSaved
      });

      setIsTracking(false);
      setCurrentTripId(null);

      // Show the stats modal with confetti!
      setCompletedTripStats({
        distance: formatDistance(distanceMiles),
        duration: formatDuration(duration),
        birdCost: formatCurrency(birdCost),
        timeSaved: formatDuration(timeSaved),
        timeValue: formatCurrency(timeValue)
      });
      setShowStatsModal(true);
      setShowConfetti(true);

      // Stop confetti after 3 seconds
      setTimeout(() => {
        setShowConfetti(false);
      }, 3000);

    } catch (error) {
      console.error('Error stopping trip:', error);
      Alert.alert('Error', 'Failed to stop trip: ' + error.message);
    }
  };

  const closeStatsModal = () => {
    setShowStatsModal(false);
    setShowConfetti(false);
    setRouteCoordinates([]); // Clear the route from map
    navigation.navigate('History');
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
              <Text style={styles.statIcon}>📍</Text>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>
                {formatDistance(metersToMiles(tripStats.distance))}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>⏱️</Text>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {formatDuration(tripStats.duration)}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>⚡</Text>
              <Text style={styles.statLabel}>Max Speed</Text>
              <Text style={styles.statValue}>
                {tripStats.maxSpeed.toFixed(1)} mph
              </Text>
            </View>
          </>
        )}
      </View>

      {isTracking && tripStats.waiting && (
        <View style={styles.waitingNotice}>
          <Text style={styles.waitingText}>
            ⏳ Waiting for movement...
          </Text>
          <Text style={styles.waitingSubtext}>
            Start scooting to begin recording
          </Text>
        </View>
      )}

      {isTracking && !tripStats.waiting && (
        <View style={styles.backgroundNotice}>
          <Text style={styles.backgroundNoticeText}>
            Recording trip
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

      {/* Trip Completed Stats Modal with Confetti */}
      <Modal
        visible={showStatsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeStatsModal}
      >
        <View style={styles.modalOverlay}>
          {showConfetti && <Confetti count={60} />}

          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎉 Trip Completed! 🛴</Text>

            <View style={styles.modalStatsContainer}>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Distance</Text>
                <Text style={styles.modalStatValue}>{completedTripStats?.distance}</Text>
              </View>

              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Duration</Text>
                <Text style={styles.modalStatValue}>{completedTripStats?.duration}</Text>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalSavingsSection}>
                <View style={styles.modalSavingsItem}>
                  <Text style={styles.modalSavingsEmoji}>💰</Text>
                  <Text style={styles.modalSavingsText}>
                    This trip would have cost{' '}
                    <Text style={styles.modalSavingsHighlight}>{completedTripStats?.birdCost}</Text>
                    {' '}on a Bird
                  </Text>
                </View>

                <View style={styles.modalSavingsItem}>
                  <Text style={styles.modalSavingsEmoji}>⏱️</Text>
                  <Text style={styles.modalSavingsText}>
                    Saved you{' '}
                    <Text style={styles.modalSavingsHighlight}>{completedTripStats?.timeSaved}</Text>
                    {' '}compared to walking
                  </Text>
                </View>

                <View style={styles.modalSavingsItem}>
                  <Text style={styles.modalSavingsEmoji}>💵</Text>
                  <Text style={styles.modalSavingsText}>
                    Which equates to{' '}
                    <Text style={styles.modalSavingsHighlight}>{completedTripStats?.timeValue}</Text>
                    {' '}worth of time
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={closeStatsModal}
            >
              <Text style={styles.modalButtonText}>View History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalStatsContainer: {
    marginBottom: 24,
  },
  modalStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalStatLabel: {
    fontSize: 16,
    color: '#666',
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 18,
  },
  modalSavingsSection: {
    marginTop: 8,
  },
  modalSavingsItem: {
    marginBottom: 18,
    alignItems: 'center',
  },
  modalSavingsEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  modalSavingsText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
  modalSavingsHighlight: {
    fontWeight: 'bold',
    color: '#4CAF50',
    fontSize: 17,
  },
  modalButton: {
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default TrackingScreen;