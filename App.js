import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { initDB } from './src/services/database';

// Screens
import TrackingScreen from './src/screens/TrackingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import StatsScreen from './src/screens/StatsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for main screens
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#65A30D',
        tabBarInactiveTintColor: '#84CC16',
      }}
    >
      <Tab.Screen
        name="Track"
        component={TrackingScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Track',
        }}
      />
      <Tab.Screen
        name="History"  
        component={HistoryScreen}
        options={{
          title: 'Trip History',
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: 'Statistics',
          tabBarLabel: 'Stats',
        }}
      />
    </Tab.Navigator>
  );
}

// Main App
function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Initialize database on app start - WAIT for it to finish
    initDB()
      .then(() => {
        console.log('Database ready!');
        setDbReady(true);
      })
      .catch(error => {
        console.error('Failed to initialize database:', error);
        // Still set ready to true so app doesn't hang forever
        setDbReady(true);
      });
  }, []);

  // Show loading screen while database initializes
  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TripDetail"
          component={TripDetailScreen}
          options={{ title: 'Trip Details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default App;
