import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { initDB } from './src/services/database';

// Screens
import TrackingScreen from './src/screens/TrackingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import StatsScreen from './src/screens/StatsScreen';
import HeatmapScreen from './src/screens/HeatmapScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for main screens
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarIconStyle: {
          marginBottom: 4,  // pushes icon upward
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          paddingBottom: 8,
          paddingTop: 5,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 1
        },
      }}
    >
      <Tab.Screen
        name="Track"
        component={TrackingScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Track',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="🛴" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Trip History',
          tabBarLabel: 'History',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="📖" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Routes"
        component={HeatmapScreen}
        options={{
          title: 'Route Map',
          tabBarLabel: 'Routes',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="🗺️" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: 'Statistics',
          tabBarLabel: 'Stats',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="📊" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const TabIcon = ({ icon, focused, color }) => {
  return (
    <Text
      style={{
        fontSize: focused ? 28 : 24,
        opacity: focused ? 1 : 0.6,
        transform: [{ scale: focused ? 1.1 : 1 }],
      }}
    >
      {icon}
    </Text>
  );
};

// Import Text for TabIcon
import { Text } from 'react-native';

// Main App
function App() {
  useEffect(() => {
    // Initialize database on app start
    initDB().catch(error => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

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

export default App;