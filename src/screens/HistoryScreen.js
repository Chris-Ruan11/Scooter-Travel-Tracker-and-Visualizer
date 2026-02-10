import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
  PanResponder
} from 'react-native';
import { getAllTrips, deleteTrip } from '../services/database';
import { getTripStats } from '../utils/calculations';
import { metersToMiles } from '../utils/calculations';

const SwipeableRow = ({ children, onDelete, borderColor }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow swiping left (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -80) {
          // Swiped far enough, show delete button
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start();
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const handleDelete = () => {
    onDelete();
    resetPosition();
  };

  return (
    <View style={styles.swipeableContainer}>
      {/* Delete button (hidden behind) */}
      <View style={[styles.deleteButtonContainer, { backgroundColor: '#F44336' }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
          <Text style={styles.deleteButtonLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable content */}
      <Animated.View
        style={[
          styles.swipeableContent,
          { transform: [{ translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const HistoryScreen = ({ navigation }) => {
  const [trips, setTrips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTrips();
    
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrips();
    });

    return unsubscribe;
  }, [navigation]);

  const loadTrips = async () => {
    try {
      const allTrips = await getAllTrips();
      const completedTrips = allTrips.filter(trip => trip.end_time);
      setTrips(completedTrips);
    } catch (error) {
      console.error('Error loading trips:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleDeleteTrip = (tripId) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrip(tripId);
              await loadTrips();
            } catch (error) {
              console.error('Error deleting trip:', error);
            }
          }
        }
      ]
    );
  };

  const getTripColor = (distanceMeters) => {
    const miles = metersToMiles(distanceMeters);
    
    if (miles < 0.5) {
      return '#4CAF50'; // Green - short
    } else if (miles < 1) {
      return '#2196F3'; // Blue - medium
    } else if (miles < 2.5) {
      return '#9C27B0'; // Purple - long
    } else {
      return '#FF5722'; // Red - very long
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
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

  const renderTrip = ({ item }) => {
    const stats = getTripStats(item, null);
    const borderColor = getTripColor(item.distance);

    return (
      <SwipeableRow 
        onDelete={() => handleDeleteTrip(item.id)}
        borderColor={borderColor}
      >
        <TouchableOpacity
          style={[styles.tripCard, { borderLeftColor: borderColor }]}
          onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
          activeOpacity={0.7}
        >
          <View style={styles.tripHeader}>
            <View>
              <Text style={styles.tripDate}>{formatDate(item.start_time)}</Text>
              <Text style={styles.tripTime}>{formatTime(item.start_time)}</Text>
            </View>
            <View style={[styles.colorBadge, { backgroundColor: borderColor }]}>
              <Text style={styles.colorBadgeText}>{stats.distance}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>⏱️</Text>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{stats.duration}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>⚡</Text>
              <Text style={styles.statLabel}>Avg Speed</Text>
              <Text style={styles.statValue}>{stats.avgSpeed}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={styles.statLabel}>Max Speed</Text>
              <Text style={styles.statValue}>{stats.maxSpeed}</Text>
            </View>
          </View>

          <View style={styles.savingsRow}>
            <Text style={styles.savingsText}>
              💰 {stats.birdCost} • ⏱️ {stats.timeSaved} saved
            </Text>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  if (trips.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛴</Text>
        <Text style={styles.emptyText}>No trips yet!</Text>
        <Text style={styles.emptySubtext}>
          Start tracking your scooter rides to see them here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  swipeableContainer: {
    marginBottom: 12,
    position: 'relative',
    height: 'auto',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: '100%',
  },
  deleteButtonText: {
    fontSize: 28,
    marginBottom: 4,
  },
  deleteButtonLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  swipeableContent: {
    backgroundColor: 'transparent',
  },
  tripCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  tripTime: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  colorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  colorBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  savingsRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  savingsText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default HistoryScreen;