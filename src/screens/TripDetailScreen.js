import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { getTrip, getTripPoints } from '../services/database';
import { getTripStats } from '../utils/calculations';

const TripDetailScreen = ({ route }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTripData();
  }, []);

  const loadTripData = async () => {
    try {
      const tripData = await getTrip(tripId);
      const tripPoints = await getTripPoints(tripId);
      setTrip(tripData);
      setPoints(tripPoints);
      setLoading(false);
    } catch (error) {
      console.error('Error loading trip:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Trip not found</Text>
      </View>
    );
  }

  const stats = getTripStats(trip, points);
  const coordinates = points.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude
  }));

  const mapRegion = coordinates.length > 0 ? {
    latitude: coordinates[0].latitude,
    longitude: coordinates[0].longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  } : null;

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(trip.start_time)}</Text>
        <Text style={styles.time}>
          {formatTime(trip.start_time)} - {formatTime(trip.end_time)}
        </Text>
      </View>

      {mapRegion && (
        <MapView
          style={styles.map}
          initialRegion={mapRegion}
        >
          <Polyline
            coordinates={coordinates}
            strokeColor="#4A90E2"
            strokeWidth={4}
          />
          {coordinates.length > 0 && (
            <>
              <Marker
                coordinate={coordinates[0]}
                pinColor="green"
                title="Start"
              />
              <Marker
                coordinate={coordinates[coordinates.length - 1]}
                pinColor="red"
                title="End"
              />
            </>
          )}
        </MapView>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{stats.distance}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{stats.duration}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Speed</Text>
            <Text style={styles.statValue}>{stats.avgSpeed}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Max Speed</Text>
            <Text style={styles.statValue}>{stats.maxSpeed}</Text>
          </View>
        </View>

        <View style={styles.savingsContainer}>
          <Text style={styles.savingsTitle}>Savings:</Text>
          <View style={styles.savingsRow}>
            <View style={styles.savingsItem}>
              <Text style={styles.savingsLabel}>💰 Cost Saved</Text>
              <Text style={styles.savingsValue}>{stats.birdCost}</Text>
            </View>
            <View style={styles.savingsItem}>
              <Text style={styles.savingsLabel}>⏱️ Time Saved</Text>
              <Text style={styles.savingsValue}>{stats.timeSaved}</Text>
              <Text style={styles.savingsSubtext}>vs walking</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>GPS Points: {stats.pointCount}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  date: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  time: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  map: {
    height: 300,
  },
  statsContainer: {
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  savingsContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  savingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  savingsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  savingsItem: {
    flex: 1,
  },
  savingsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  savingsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  savingsSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  infoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
});

export default TripDetailScreen;
