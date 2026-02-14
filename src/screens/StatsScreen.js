import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl
} from 'react-native';
import { getTotalStats } from '../services/database';
import {
  formatDistance,
  formatDuration,
  formatCurrency,
  metersToMiles,
  calculateTimeSavingsValue
} from '../utils/calculations';

const StatsScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();

    const unsubscribe = navigation.addListener('focus', () => {
      loadStats();
    });

    return unsubscribe;
  }, [navigation]);

  const loadStats = async () => {
    try {
      const totalStats = await getTotalStats();
      setStats(totalStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  if (!stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading stats...</Text>
      </View>
    );
  }

  if (stats.total_trips === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trips yet!</Text>
        <Text style={styles.emptySubtext}>
          Start tracking rides to see your stats
        </Text>
      </View>
    );
  }

  const totalDistance = metersToMiles(stats.total_distance || 0);
  const totalDuration = stats.total_duration || 0;
  const avgSpeed = stats.overall_avg_speed || 0;
  const timeValue = calculateTimeSavingsValue(stats.total_time_saved || 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Scooter Stats</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.bigStatCard}>
          <Text style={styles.bigStatLabel}>Total Distance</Text>
          <Text style={styles.bigStatValue}>
            {formatDistance(totalDistance)}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Trips</Text>
            <Text style={styles.statValue}>{stats.total_trips}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Time</Text>
            <Text style={styles.statValue}>
              {formatDuration(totalDuration)}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg Speed</Text>
            <Text style={styles.statValue}>{avgSpeed.toFixed(1)} mph</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg Distance</Text>
            <Text style={styles.statValue}>
              {formatDistance(totalDistance / stats.total_trips)}
            </Text>
          </View>
        </View>

        <View style={styles.savingsCard}>
          <Text style={styles.savingsTitle}>Total Savings</Text>

          <View style={styles.savingsRow}>

            <View style={styles.savingsItem}>
              <Text style={styles.savingsEmoji}>💰</Text>
              <Text style={styles.savingsLabel}>Cost saved</Text>
              <Text style={styles.savingsValue}>
                {formatDuration(stats.total_cost_saved || 0)}
              </Text>
              <Text style={styles.savingsSubtext}>from Birds</Text>
            </View>

            <View style={styles.savingsDivider} />

            <View style={styles.savingsItem}>
              <Text style={styles.savingsEmoji}>⏱️</Text>
              <Text style={styles.savingsLabel}>Time Saved</Text>
              <Text style={styles.savingsValue}>
                {formatDuration(stats.total_time_saved || 0)}
              </Text>
              <Text style={styles.savingsSubtext}>vs walking</Text>
            </View>

            <View style={styles.savingsDivider} />

            <View style={styles.savingsItem}>
              <Text style={styles.savingsEmoji}>💵</Text>
              <Text style={styles.savingsLabel}>That's worth</Text>
              <Text style={styles.savingsValue}>
                {formatCurrency(timeValue)}
              </Text>
              <Text style={styles.savingsSubtext}>@ $20/hour</Text>
            </View>
          </View>
        </View>

        <View style={styles.funFactsCard}>
          <Text style={styles.funFactsTitle}>Fun Facts</Text>
          <Text style={styles.funFact}>
            🌍 At walking speed, you'd only have walked {(totalDistance / avgSpeed * 3).toFixed(1)} miles
          </Text>
          <Text style={styles.funFact}>
            🚗 You've scooted {(totalDistance / 2800 * 100).toFixed(1)}% of a 2,800 mi cross-country trip
          </Text>
          <Text style={styles.funFact}>
            ⚡ Average trip: {formatDuration(totalDuration / stats.total_trips)}
          </Text>
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
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    padding: 16,
  },
  bigStatCard: {
    backgroundColor: '#4A90E2',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bigStatLabel: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  bigStatValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  savingsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  savingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsItem: {
    flex: 1,
    alignItems: 'center',
  },
  savingsDivider: {
    width: 1,
    height: 80,
    backgroundColor: '#eee',
  },
  savingsEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  savingsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  savingsSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  funFactsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  funFactsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  funFact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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

export default StatsScreen;
