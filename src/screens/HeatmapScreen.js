import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { getAllTrips, getTripPoints } from '../services/database';

const HeatmapScreen = () => {
  const [loading, setLoading] = useState(true);
  const [routeSegments, setRouteSegments] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [totalTrips, setTotalTrips] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const mapRef = useRef(null);

  // Segment size in degrees 
  const SEGMENT_SIZE = 0.00055;

  useEffect(() => {
    loadRouteData();
  }, []);

  const loadRouteData = async () => {
    try {
      setLoading(true);
      
      // Get all completed trips
      const trips = await getAllTrips();
      const completedTrips = trips.filter(trip => trip.end_time);

      if (completedTrips.length === 0) {
        setLoading(false);
        return;
      }

      setTotalTrips(completedTrips.length);
      
      // Track total distance
      const totalDist = completedTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
      setTotalDistance(totalDist);

      // Store all route segments with their frequency
      const segmentMap = {};
      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;

      // Load all GPS points and create segments
      for (const trip of completedTrips) {
        const points = await getTripPoints(trip.id);
        
        // Create route segments
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          
          // Create segment key (rounded to SEGMENT_SIZE)
          const lat1 = Math.round(p1.latitude / SEGMENT_SIZE) * SEGMENT_SIZE;
          const lon1 = Math.round(p1.longitude / SEGMENT_SIZE) * SEGMENT_SIZE;
          const lat2 = Math.round(p2.latitude / SEGMENT_SIZE) * SEGMENT_SIZE;
          const lon2 = Math.round(p2.longitude / SEGMENT_SIZE) * SEGMENT_SIZE;
          
          const key = `${lat1},${lon1}-${lat2},${lon2}`;
          
          if (!segmentMap[key]) {
            segmentMap[key] = {
              start: { latitude: p1.latitude, longitude: p1.longitude },
              end: { latitude: p2.latitude, longitude: p2.longitude },
              count: 0
            };
          }
          segmentMap[key].count += 1;

          // Track bounds
          minLat = Math.min(minLat, p1.latitude, p2.latitude);
          maxLat = Math.max(maxLat, p1.latitude, p2.latitude);
          minLon = Math.min(minLon, p1.longitude, p2.longitude);
          maxLon = Math.max(maxLon, p1.longitude, p2.longitude);
        }
      }

      // Find max count for scaling
      const maxCount = Math.max(...Object.values(segmentMap).map(s => s.count));

      // Convert to array with color/width based on frequency
      const segments = Object.values(segmentMap).map(segment => ({
        coordinates: [segment.start, segment.end],
        count: segment.count,
        ...getSegmentStyle(segment.count, maxCount)
      }));

      setRouteSegments(segments);

      // Set map region
      if (minLat !== Infinity) {
        setMapRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max((maxLat - minLat) * 1.3, 0.01),
          longitudeDelta: Math.max((maxLon - minLon) * 1.3, 0.01),
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading route data:', error);
      setLoading(false);
    }
  };

  // Get color and width based on frequency (like Strava)
  const getSegmentStyle = (count, max) => {
    const frequency = count / max;
    
    // Color progression: blue → cyan → yellow → orange → red
    let color;
    let strokeWidth;
    
    if (frequency < 0.2) {
      // Rare: Light blue
      color = 'rgba(187, 222, 251, 0.9)';
      strokeWidth = 3;
    } else if (frequency < 0.4) {
      // Occasional: Blue
      color = 'rgba(66, 165, 245, 0.9)';
      strokeWidth = 4;
    } else if (frequency < 0.6) {
      // Regular: Cyan/Yellow
      color = 'rgba(26, 121, 206, 0.91)';
      strokeWidth = 5;
    } else if (frequency < 0.8) {
      // Frequent: Orange
      color = 'rgba(255, 167, 38, 0.85)';
      strokeWidth = 6;
    } else {
      // Very frequent: Red
      color = 'rgba(244, 67, 54, 0.9)';
      strokeWidth = 7;
    }
    
    return { color, strokeWidth };
  };

  const fitToRoutes = () => {
    if (mapRef.current && mapRegion) {
      mapRef.current.animateToRegion(mapRegion, 1000);
    }
  };

  const metersToMiles = (meters) => meters * 0.000621371;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading your routes...</Text>
      </View>
    );
  }

  if (routeSegments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyText}>No routes yet!</Text>
        <Text style={styles.emptySubtext}>
          Start tracking rides to see your route map
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
      >
        {routeSegments.map((segment, index) => (
          <Polyline
            key={index}
            coordinates={segment.coordinates}
            strokeColor={segment.color}
            strokeWidth={segment.strokeWidth}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </MapView>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Routes</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {metersToMiles(totalDistance).toFixed(1)} mi
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{routeSegments.length}</Text>
            <Text style={styles.statLabel}>Segments</Text>
          </View>
        </View>
      </View>

      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Frequency</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: 'rgba(187, 222, 251, 0.9)' }]} />
            <Text style={styles.legendText}>Rare</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: 'rgba(66, 165, 245, 0.9)' }]} />
            <Text style={styles.legendText}>Some</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: 'rgba(26, 121, 206, 0.91)' }]} />
            <Text style={styles.legendText}>Regular</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: 'rgba(255, 167, 38, 0.9)' }]} />
            <Text style={styles.legendText}>Frequent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: 'rgba(244, 67, 54, 0.9)' }]} />
            <Text style={styles.legendText}>Very</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.fitButton} onPress={fitToRoutes}>
        <Text style={styles.fitButtonText}>🎯 Center</Text>
      </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statsCard: {
    position: 'absolute',
    top: 25,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  legendCard: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    alignItems: 'center',
  },
  legendLine: {
    width: 30,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  legendText: {
    fontSize: 9,
    color: '#666',
  },
  fitButton: {
    position: 'absolute',
    bottom: 105,
    alignSelf: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  fitButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default HeatmapScreen;