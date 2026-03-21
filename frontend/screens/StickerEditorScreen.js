import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ImageBackground,
  PanResponder,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

// ─── Constants ─────────────────────────────────────────────────────────────────
const MAX_SIZE = 5 * 1024 * 1024;
const DRAG_DAMPING = 0.5; // ← sensitivity: lower = less sensitive, higher = more
const PRESET_COLORS = ['#ffffff', '#000000', '#f87171', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#fb923c'];

// ─── Upload Helper ─────────────────────────────────────────────────────────────
const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const resp = await fetch(file.uri);
    const blob = await resp.blob();
    formData.append('file', blob, file.name || 'upload');
  } else {
    formData.append('file', {
      uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
      name: file.name,
      type: file.type,
    });
  }
  const { data } = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.data?.url || data?.url;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── DraggableText ────────────────────────────────────────────────────────────
// Renders text at a fractional position.
// DAMPING: moves at DRAG_DAMPING × the raw pan delta → less jittery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DraggableText = ({ text, color, position, onPositionChange, canvasSize, isPreview, isActive, onTap }) => {
  // Stores base position at gesture start
  const startPosRef = useRef({ ...position });
  // Stores the last committed position (updated in real-time during drag)
  const currentPosRef = useRef({ ...position });
  // keeps position ref in sync when prop changes externally (e.g. parent re-renders)
  currentPosRef.current = { ...position };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isPreview,
      onMoveShouldSetPanResponder: () => !isPreview,
      onPanResponderGrant: () => {
        // Snapshot the position at the START of the gesture
        startPosRef.current = { ...currentPosRef.current };
        onTap?.();
      },
      onPanResponderMove: (_, g) => {
        if (isPreview || !canvasSize.width) return;
        // g.dx/g.dy are CUMULATIVE from gesture start — so we add them to the
        // snapshot taken at grant time, scaled by canvas size + damping factor.
        const newX = Math.max(0.02, Math.min(0.98,
          startPosRef.current.x + (g.dx * DRAG_DAMPING) / canvasSize.width
        ));
        const newY = Math.max(0.02, Math.min(0.98,
          startPosRef.current.y + (g.dy * DRAG_DAMPING) / canvasSize.height
        ));
        onPositionChange({ x: newX, y: newY });
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  if (!text) return null;

  return (
    <View
      pointerEvents={isPreview ? 'none' : 'auto'}
      {...(!isPreview ? panResponder.panHandlers : {})}
      style={[
        s.draggableTextWrapper,
        {
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
          // Center the label on the fractional point
          transform: [{ translateX: -50 }, { translateY: -18 }],
        },
        !isPreview && s.draggableTextEditMode,
        !isPreview && isActive && s.draggableTextActive,
      ]}
    >
      <Text style={[s.overlayText, { color, textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 }]}>
        {text}
      </Text>
      {!isPreview && (
        <View style={s.dragHandle}>
          <MaterialCommunityIcons name="drag" size={10} color="rgba(255,255,255,0.9)" />
        </View>
      )}
    </View>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── EditorCanvas ─────────────────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EditorCanvas = ({ imageUri, overlays, onPositionChange, activeOverlay, onActivateOverlay, isPreview, theme }) => {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  return (
    <View
      style={[s.canvas, { backgroundColor: theme['surface-container-high'] || theme.card }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setCanvasSize({ width, height });
      }}
    >
      {imageUri ? (
        <ImageBackground source={{ uri: imageUri }} style={s.canvasImage} resizeMode="contain">
          {overlays.map((ov, idx) => (
            <DraggableText
              key={idx}
              text={ov.text}
              color={ov.color}
              position={ov.position}
              onPositionChange={(pos) => onPositionChange(idx, pos)}
              canvasSize={canvasSize}
              isPreview={isPreview}
              isActive={activeOverlay === idx}
              onTap={() => onActivateOverlay(idx)}
            />
          ))}
        </ImageBackground>
      ) : (
        <View style={s.canvasEmpty}>
          <MaterialCommunityIcons name="image-plus" size={52} color={theme['on-surface-variant'] || theme.textSecondary} />
          <Text style={[s.canvasEmptyText, { color: theme['on-surface-variant'] || theme.textSecondary }]}>
            Select an image or GIF
          </Text>
        </View>
      )}
    </View>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── ColorRow ─────────────────────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ColorRow = ({ selectedColor, onSelect }) => (
  <View style={s.colorRow}>
    {PRESET_COLORS.map((c) => (
      <TouchableOpacity
        key={c}
        style={[s.colorSwatch, { backgroundColor: c }, selectedColor === c && s.colorSwatchActive]}
        onPress={() => onSelect(c)}
      />
    ))}
  </View>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── AudioAttachButton ────────────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _recording = null;

const AudioAttachButton = ({ selectedAudio, onAudioChange, theme }) => {
  const [isRecording, setIsRecording] = useState(false);

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset.size && asset.size > MAX_SIZE) { Alert.alert('Too large', 'Audio must be under 5 MB.'); return; }
        onAudioChange({ uri: asset.uri, name: asset.name, type: asset.mimeType || 'audio/mpeg', size: asset.size || 0 });
      }
    } catch { Alert.alert('Error', 'Could not open audio picker.'); }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      _recording = recording;
      setIsRecording(true);
    } catch { Alert.alert('Error', 'Could not start recording.'); }
  };

  const stopRecording = async () => {
    if (!_recording) return;
    setIsRecording(false);
    await _recording.stopAndUnloadAsync();
    const uri = _recording.getURI();
    _recording = null;
    onAudioChange({ uri, name: `recording_${Date.now()}.m4a`, type: 'audio/m4a', size: 0 });
  };

  return (
    <View style={s.audioRow}>
      <Text style={[s.sectionLabel, { color: theme['on-surface-variant'] || theme.textSecondary }]}>Audio (optional)</Text>
      <View style={s.audioButtons}>
        {!isRecording && (
          <TouchableOpacity style={[s.audioBtn, { backgroundColor: theme['surface-container-low'] || theme.input }]} onPress={pickAudioFile}>
            <Ionicons name="document-text-outline" size={16} color={theme['on-surface-variant'] || theme.text} />
            <Text style={[s.audioBtnText, { color: theme['on-surface'] || theme.text }]}>Pick File</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.audioBtn, { backgroundColor: isRecording ? (theme.error || '#ff4d4d') + '22' : (theme['surface-container-low'] || theme.input) }]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons name={isRecording ? 'stop-circle' : 'mic-outline'} size={16} color={isRecording ? (theme.error || '#ff4d4d') : (theme['on-surface-variant'] || theme.text)} />
          <Text style={[s.audioBtnText, { color: isRecording ? (theme.error || '#ff4d4d') : (theme['on-surface'] || theme.text) }]}>
            {isRecording ? 'Stop' : 'Record'}
          </Text>
        </TouchableOpacity>
      </View>
      {selectedAudio && (
        <View style={[s.audioChip, { backgroundColor: theme['surface-container-low'] || theme.input }]}>
          <Ionicons name="mic" size={13} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={[s.audioChipText, { color: theme['on-surface'] || theme.text }]} numberOfLines={1}>{selectedAudio.name}</Text>
          <TouchableOpacity onPress={() => onAudioChange(null)} style={{ marginLeft: 8 }}>
            <Ionicons name="close-circle" size={16} color={theme.error || '#ff4d4d'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── StickerEditorScreen ──────────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_OVERLAY = (y = 0.5) => ({ text: '', color: '#ffffff', position: { x: 0.5, y } });

export default function StickerEditorScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const userId = route?.params?.userId;

  const [selectedImage, setSelectedImage] = useState(null);
  const [overlays, setOverlays] = useState([DEFAULT_OVERLAY(0.5)]); // start with 1 overlay
  const [hasSecondOverlay, setHasSecondOverlay] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  // Keep position updates snappy without re-rendering the whole screen
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const handlePositionChange = useCallback((idx, pos) => {
    setOverlays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], position: pos };
      return next;
    });
  }, []);

  const updateOverlayText = (idx, text) =>
    setOverlays((prev) => { const n = [...prev]; n[idx] = { ...n[idx], text }; return n; });

  const updateOverlayColor = (idx, color) =>
    setOverlays((prev) => { const n = [...prev]; n[idx] = { ...n[idx], color }; return n; });

  const addSecondOverlay = () => {
    setOverlays((prev) => [...prev, DEFAULT_OVERLAY(0.7)]);
    setHasSecondOverlay(true);
    setActiveOverlay(1);
  };

  const removeSecondOverlay = () => {
    setOverlays((prev) => [prev[0]]);
    setHasSecondOverlay(false);
    setActiveOverlay(0);
  };

  // ─── Image Picker ──────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_SIZE) { Alert.alert('Too large', 'Image must be under 5 MB.'); return; }
      setSelectedImage({ uri: asset.uri, name: asset.fileName || `sticker_${Date.now()}.jpg`, type: asset.type || 'image/jpeg' });
      setIsPreview(false);
    }
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedImage) { Alert.alert('', 'Select an image first.'); return; }
    if (!userId) { Alert.alert('Error', 'Not logged in.'); return; }

    setUploading(true);
    try {
      const mediaUrl = await uploadToCloudinary(selectedImage);
      let audioUrl = null;
      if (selectedAudio) audioUrl = await uploadToCloudinary(selectedAudio);

      const activeOverlays = overlaysRef.current.filter((ov) => ov.text.trim());

      const payload = {
        userId,
        mediaUrl,
        audioUrl,
        text: activeOverlays[0]?.text || '',
        textPosition: activeOverlays[0]?.position || { x: 0.5, y: 0.5 },
        overlays: activeOverlays,
        isPublic,
      };

      await api.post('/stickers', payload);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 1500);

    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save sticker.');
    } finally {
      setUploading(false);
    }
  };

  const canSave = !!selectedImage && !uploading;
  const ov = overlays[activeOverlay] || overlays[0];

  return (
    <View style={[s.root, { backgroundColor: theme['background'] || theme.bg }]}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: theme['surface-container'] || theme.card, borderBottomColor: (theme['outline-variant'] || '#333') + '40' }]}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme['on-surface-variant'] || theme.textSecondary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme['on-surface'] || theme.text }]}>Sticker Editor</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => setIsPreview((v) => !v)} disabled={!selectedImage}>
          <MaterialCommunityIcons
            name={isPreview ? 'pencil' : 'eye'}
            size={22}
            color={selectedImage ? (theme.primary || '#c0c1ff') : (theme['outline'] || '#666')}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.body, isDesktop && s.bodyDesktop]} keyboardShouldPersistTaps="handled">

        {/* ── Canvas ── */}
        <View style={isDesktop ? s.canvasDesktopWrapper : s.canvasMobileWrapper}>
          <EditorCanvas
            imageUri={selectedImage?.uri}
            overlays={overlays}
            onPositionChange={handlePositionChange}
            activeOverlay={activeOverlay}
            onActivateOverlay={setActiveOverlay}
            isPreview={isPreview}
            theme={theme}
          />
          {!isPreview && selectedImage && (
            <Text style={[s.hintText, { color: theme['outline'] || theme.textSecondary }]}>
              Tap a text label to select it · Drag to reposition
            </Text>
          )}
          {isPreview && (
            <View style={s.previewBadge}><Text style={s.previewBadgeText}>PREVIEW</Text></View>
          )}
        </View>

        <View style={[s.controls, { backgroundColor: theme['surface-container-low'] || theme.card, borderColor: (theme['outline-variant'] || '#333') + '30' }]}>

          {/* ── Image Picker ── */}
          <TouchableOpacity
            style={[s.pickImageBtn, { backgroundColor: theme['surface-container-lowest'] || theme.input, borderColor: (theme['outline-variant'] || '#333') + '40' }]}
            onPress={pickImage}
          >
            <Ionicons name={selectedImage ? 'image' : 'image-outline'} size={20} color={selectedImage ? theme.primary : (theme['on-surface-variant'] || theme.textSecondary)} />
            <Text style={[s.pickImageText, { color: selectedImage ? theme.primary : (theme['on-surface-variant'] || theme.textSecondary) }]}>
              {selectedImage ? 'Change Image/GIF' : 'Select Image/GIF'}
            </Text>
          </TouchableOpacity>

          {/* ── Overlay Tabs ── */}
          <View style={s.overlayTabRow}>
            <TouchableOpacity
              style={[s.overlayTab, activeOverlay === 0 && { borderBottomColor: theme.primary || '#c0c1ff', borderBottomWidth: 2 }]}
              onPress={() => setActiveOverlay(0)}
            >
              <Text style={[s.overlayTabText, { color: activeOverlay === 0 ? (theme.primary || '#c0c1ff') : (theme['on-surface-variant'] || theme.textSecondary) }]}>
                Text 1
              </Text>
            </TouchableOpacity>
            {hasSecondOverlay && (
              <TouchableOpacity
                style={[s.overlayTab, activeOverlay === 1 && { borderBottomColor: theme.primary || '#c0c1ff', borderBottomWidth: 2 }]}
                onPress={() => setActiveOverlay(1)}
              >
                <Text style={[s.overlayTabText, { color: activeOverlay === 1 ? (theme.primary || '#c0c1ff') : (theme['on-surface-variant'] || theme.textSecondary) }]}>
                  Text 2
                </Text>
              </TouchableOpacity>
            )}
            {!hasSecondOverlay && (
              <TouchableOpacity style={s.addOverlayBtn} onPress={addSecondOverlay}>
                <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
                <Text style={[s.addOverlayText, { color: theme.primary }]}>Add 2nd Text</Text>
              </TouchableOpacity>
            )}
            {hasSecondOverlay && (
              <TouchableOpacity style={s.removeOverlayBtn} onPress={removeSecondOverlay}>
                <Ionicons name="remove-circle-outline" size={16} color={theme.error || '#ff4d4d'} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Text Input for active overlay ── */}
          <View style={s.textInputGroup}>
            <Text style={[s.sectionLabel, { color: theme['on-surface-variant'] || theme.textSecondary }]}>
              Text Overlay {activeOverlay + 1}
            </Text>
            <TextInput
              key={activeOverlay}
              style={[s.textOverlayInput, { backgroundColor: theme['surface-container-lowest'] || theme.input, color: ov.color, borderColor: ov.color + '66' }]}
              value={ov.text}
              onChangeText={(t) => updateOverlayText(activeOverlay, t)}
              placeholder="Type your overlay text..."
              placeholderTextColor={theme['outline'] || theme.textSecondary}
              maxLength={60}
              returnKeyType="done"
            />
            <Text style={[s.charCount, { color: theme['outline'] || theme.textSecondary }]}>{ov.text.length}/60</Text>

            {/* ── Color Picker for active overlay ── */}
            <Text style={[s.sectionLabel, { color: theme['on-surface-variant'] || theme.textSecondary, marginTop: 8 }]}>Text Color</Text>
            <ColorRow selectedColor={ov.color} onSelect={(c) => updateOverlayColor(activeOverlay, c)} />
          </View>

          {/* ── Audio ── */}
          <AudioAttachButton selectedAudio={selectedAudio} onAudioChange={setSelectedAudio} theme={theme} />

          {/* ── Public Toggle ── */}
          <TouchableOpacity style={s.toggleRow} onPress={() => setIsPublic((v) => !v)}>
            <View style={[s.toggleTrack, { backgroundColor: isPublic ? (theme.primary || '#c0c1ff') + '33' : (theme['surface-container-high'] || '#222a3d') }]}>
              <View style={[s.toggleThumb, { backgroundColor: isPublic ? (theme.primary || '#c0c1ff') : (theme['on-surface-variant'] || '#666'), transform: [{ translateX: isPublic ? 20 : 0 }] }]} />
            </View>
            <Text style={[s.toggleLabel, { color: theme['on-surface-variant'] || theme.textSecondary }]}>
              {isPublic ? 'Public sticker' : 'Private sticker'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[s.bottomBar, { backgroundColor: theme['surface-container'] || theme.card, borderTopColor: (theme['outline-variant'] || '#333') + '30' }]}>
        <TouchableOpacity style={[s.cancelBtn, { borderColor: (theme['outline-variant'] || '#333') + '60' }]} onPress={() => navigation.goBack()}>
          <Text style={[s.cancelBtnText, { color: theme['on-surface-variant'] || theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!canSave} onPress={handleSave} style={{ flex: 1 }}>
          <LinearGradient
            colors={[theme['primary-container'] || '#5d60eb', theme['secondary-container'] || '#571bc1']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
          >
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <MaterialCommunityIcons name="content-save" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.saveBtnText}>Save to Library</Text>
                </>
              )
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  body: { padding: 16, paddingBottom: 32 },
  bodyDesktop: { maxWidth: 600, alignSelf: 'center', width: '100%' },

  canvasMobileWrapper: { marginBottom: 12, position: 'relative' },
  canvasDesktopWrapper: { marginBottom: 16, position: 'relative' },

  canvas: { width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' },
  canvasImage: { flex: 1 },
  canvasEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  canvasEmptyText: { fontSize: 13, fontWeight: '500' },

  hintText: { fontSize: 10, marginTop: 5, textAlign: 'center', fontStyle: 'italic' },
  previewBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  previewBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // DraggableText
  draggableTextWrapper: { position: 'absolute', transform: [{ translateX: -40 }, { translateY: -14 }], alignItems: 'center' },
  draggableTextEditMode: { padding: 4 },
  draggableTextActive: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 6, borderStyle: 'dashed' },
  overlayText: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  dragHandle: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: 2, marginTop: 2 },

  controls: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 20 },

  pickImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  pickImageText: { fontSize: 14, fontWeight: '600' },

  // Overlay tabs
  overlayTabRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.15)', marginBottom: 4 },
  overlayTab: { paddingVertical: 8, paddingHorizontal: 14, marginBottom: -1 },
  overlayTabText: { fontSize: 13, fontWeight: '700' },
  addOverlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 10, marginLeft: 4 },
  addOverlayText: { fontSize: 12, fontWeight: '700' },
  removeOverlayBtn: { marginLeft: 'auto', padding: 8 },

  textInputGroup: { gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  textOverlayInput: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1.5 },
  charCount: { fontSize: 10, alignSelf: 'flex-end' },

  // Color picker
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 4, elevation: 4 },

  audioRow: { gap: 8 },
  audioButtons: { flexDirection: 'row', gap: 8 },
  audioBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  audioBtnText: { fontSize: 12, fontWeight: '600' },
  audioChip: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10 },
  audioChipText: { flex: 1, fontSize: 12 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10 },
  toggleLabel: { flex: 1, fontSize: 13 },

  bottomBar: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  cancelBtn: { paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
