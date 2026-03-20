import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { getSocket, disconnectSocket } from '../services/socketService';

export default function HomeScreen({ navigation, route }) {
  const { userId, username } = route.params;
  const [receiverId, setReceiverId] = useState('');

  // Connect socket and join personal room on mount
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', userId);

    // Cleanup socket on screen unmount
    return () => {
      // Don't disconnect here as we need it in ChatScreen.
      // Socket is disconnected on logout only.
    };
  }, [userId]);

  const handleStartChat = async () => {
    const trimmedId = receiverId.trim();

    if (!trimmedId) {
      Alert.alert('Error', 'Please enter a User ID to chat with.');
      return;
    }

    if (trimmedId === userId) {
      Alert.alert('Error', "You can't chat with yourself.");
      return;
    }

    try {
      // Validate that the receiver exists
      const response = await api.get(`/users/${trimmedId}`);
      const receiver = response.data;

      navigation.navigate('Chat', {
        userId,
        username,
        receiverId: receiver._id,
        receiverUsername: receiver.username,
      });
    } catch (error) {
      if (error.response?.status === 404) {
        Alert.alert('Not Found', 'No user found with that ID.');
      } else {
        Alert.alert('Error', 'Could not find user. Please check the ID.');
      }
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    disconnectSocket();
    navigation.replace('Login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.username}>@{username}</Text>
        <View style={styles.idContainer}>
          <Text style={styles.idLabel}>Your User ID</Text>
          <Text style={styles.userId} selectable>{userId}</Text>
          <Text style={styles.idHint}>Share this ID with others so they can chat with you</Text>
        </View>
      </View>

      {/* Start Chat Card */}
      <View style={styles.chatCard}>
        <Text style={styles.chatCardTitle}>Start a New Chat</Text>
        <TextInput
          style={styles.input}
          placeholder="Paste a User ID here"
          placeholderTextColor="#888"
          value={receiverId}
          onChangeText={setReceiverId}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.button} onPress={handleStartChat}>
          <Text style={styles.buttonText}>Start Chat →</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 24,
    paddingTop: 40,
  },
  profileCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#e0aaff',
  },
  welcomeText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  username: {
    color: '#e0aaff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },
  idContainer: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 14,
  },
  idLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userId: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Platform?.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 8,
  },
  idHint: {
    color: '#666',
    fontSize: 11,
  },
  chatCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  chatCardTitle: {
    color: '#e0aaff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7b2d8b',
    fontFamily: Platform?.OS === 'android' ? 'monospace' : 'Courier',
  },
  button: {
    backgroundColor: '#7b2d8b',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    alignItems: 'center',
    padding: 16,
  },
  logoutText: {
    color: '#555',
    fontSize: 14,
  },
});
