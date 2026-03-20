import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';

// ─── Login / Register Screen ───────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async () => {
    const trimUser  = username.trim();
    const trimEmail = email.trim();

    if (!trimEmail) { Alert.alert('Error', 'Email is required.'); return; }
    if (!password)  { Alert.alert('Error', 'Password is required.'); return; }
    if (!isLogin && !trimUser) { Alert.alert('Error', 'Username is required.'); return; }
    if (!isLogin && password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin
        ? { email: trimEmail, password }
        : { username: trimUser, email: trimEmail, password };

      const res = await api.post(endpoint, body);
      const { data } = res.data; // New format is { success: true, data: { ... } }
      
      await AsyncStorage.multiSet([
        ['userId', data.userId],
        ['username', data.username],
        ['accessToken', data.accessToken],
        ['refreshToken', data.refreshToken],
      ]);
      
      if (data.vibeId) await AsyncStorage.setItem('vibeId', data.vibeId);
      navigation.replace('Main');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Could not connect to server.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Theme toggle */}
      <TouchableOpacity style={s.themeToggle} onPress={toggleTheme}>
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={24} color={theme.accent} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Ionicons name="chatbubbles" size={64} color={theme.accent} style={{ marginBottom: 10 }} />
          <Text style={[s.title, { color: theme.accent }]}>VibeChat</Text>

          {/* Mode tabs */}
          <View style={[s.tabs, { backgroundColor: theme.card, borderColor: theme.inputBorder }]}>
            <TouchableOpacity
              style={[s.tab, isLogin && { backgroundColor: theme.sendBtn }]}
              onPress={() => setMode('login')}
            >
              <Text style={[s.tabText, { color: isLogin ? '#fff' : theme.textSecondary }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, !isLogin && { backgroundColor: theme.sendBtn }]}
              onPress={() => setMode('register')}
            >
              <Text style={[s.tabText, { color: !isLogin ? '#fff' : theme.textSecondary }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Username — register only */}
          {!isLogin && (
            <TextInput
              style={s.input}
              placeholder="Username"
              placeholderTextColor={theme.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={s.input}
            placeholder="Email address"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            style={[s.button, { backgroundColor: theme.sendBtn }, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{isLogin ? 'Sign In →' : 'Create Account →'}</Text>
            }
          </TouchableOpacity>

          <Text style={[s.switchHint, { color: theme.textSecondary }]}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text
              style={{ color: theme.accent, fontWeight: '600' }}
              onPress={() => setMode(isLogin ? 'register' : 'login')}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    scroll:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    themeToggle: { position: 'absolute', top: 20, right: 20, padding: 10, zIndex: 10 },
    themeIcon: { fontSize: 22 },
    card: {
      width: '100%', maxWidth: 420,
      backgroundColor: theme.sidebar,
      borderRadius: 16, padding: 36,
      alignItems: 'center',
      borderWidth: 1, borderColor: theme.sidebarBorder,
    },
    logo:  { fontSize: 48, marginBottom: 10 },
    title: { fontSize: 30, fontWeight: '800', marginBottom: 24 },
    tabs: {
      flexDirection: 'row', borderRadius: 10, borderWidth: 1,
      overflow: 'hidden', marginBottom: 24, width: '100%',
    },
    tab:     { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabText: { fontWeight: '600', fontSize: 14 },
    input: {
      width: '100%', backgroundColor: theme.input,
      borderRadius: 10, padding: 14,
      color: theme.text, fontSize: 15,
      marginBottom: 12,
      borderWidth: 1, borderColor: theme.inputBorder,
    },
    button:    { width: '100%', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
    btnDisabled: { opacity: 0.6 },
    btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
    switchHint:{ marginTop: 20, fontSize: 13 },
  });
