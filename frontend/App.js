import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from './context/ThemeContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import StickerEditorScreen from './screens/StickerEditorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  // Check AsyncStorage on startup to persist login across refreshes
  const [initialRoute, setInitialRoute] = useState(null); // null = still checking

  useEffect(() => {
    AsyncStorage.getItem('userId').then((uid) => {
      setInitialRoute(uid ? 'Main' : 'Login');
    });
  }, []);

  // Show a blank screen while we check storage (avoids flash to Login)
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' }}>
        <ActivityIndicator color="#58a6ff" size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="StickerEditor" component={StickerEditorScreen} options={{ presentation: 'card' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
