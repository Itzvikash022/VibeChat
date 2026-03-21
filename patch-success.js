const fs = require('fs');

function patchStickerEditorScreen() {
  const file = 'd:/Projects/VibeChat/frontend/screens/StickerEditorScreen.js';
  let content = fs.readFileSync(file, 'utf8');

  // Add state
  content = content.replace(
    /const \[uploading, setUploading\] = useState\(false\);\n  const \[isPublic, setIsPublic\] = useState\(false\);/,
    `const [uploading, setUploading] = useState(false);\n  const [isPublic, setIsPublic] = useState(false);\n  const [showSuccess, setShowSuccess] = useState(false);`
  );

  // Update handleSave
  let saveTarget = `      await api.post('/stickers', payload);
      // Navigate back immediately — don't wait for user to tap OK
      navigation.goBack();
      // Show non-blocking success on mobile; on web use console (no Alert needed)
      if (Platform.OS !== 'web') {
        Alert.alert('✅ Saved!', 'Sticker added to your library.');
      }`;
  let saveTargetCRLF = saveTarget.replace(/\n/g, '\r\n');
  let saveReplace = `      await api.post('/stickers', payload);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 1500);`;

  if (content.includes(saveTarget)) content = content.replace(saveTarget, saveReplace);
  else if (content.includes(saveTargetCRLF)) content = content.replace(saveTargetCRLF, saveReplace);

  // Inject overlay before closing View
  let overlayCode = `
      {showSuccess && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <View style={{ backgroundColor: theme['surface-container'] || theme.card || '#2a2d3a', padding: 32, borderRadius: 20, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={72} color={theme.tertiary || theme.primary || '#65d9a5'} />
            <Text style={{ color: theme['on-surface'] || theme.text || '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 16 }}>Successfully Added!</Text>
          </View>
        </View>
      )}
    </View>
  );
}
`;
  content = content.replace(/    <\/View>\n  \);\n}\n/g, overlayCode);

  fs.writeFileSync(file, content);
  console.log('StickerEditorScreen.js patched with Success UI');
}

function patchStickerPicker() {
  const file = 'd:/Projects/VibeChat/frontend/components/StickerPicker.js';
  let content = fs.readFileSync(file, 'utf8');

  // Add state
  content = content.replace(
    /const \[uploading, setUploading\] = useState\(false\);/,
    `const [uploading, setUploading] = useState(false);\n  const [showSuccess, setShowSuccess] = useState(false);`
  );

  // Update handleCreate
  let saveTarget = `      const { data } = await api.post('/stickers', payload);
      console.log('Sticker Saved:', data);

      Alert.alert('Success', 'Sticker added to library!');
      // Reset & Switch
      setSelectedImage(null);
      setSelectedAudio(null);
      setActiveTab('library');`;
  
  let saveTargetCRLF = saveTarget.replace(/\n/g, '\r\n');
  let saveReplace = `      const { data } = await api.post('/stickers', payload);
      console.log('Sticker Saved:', data);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedImage(null);
        setSelectedAudio(null);
        setActiveTab('library');
      }, 1500);`;

  if (content.includes(saveTarget)) content = content.replace(saveTarget, saveReplace);
  else if (content.includes(saveTargetCRLF)) content = content.replace(saveTargetCRLF, saveReplace);

  // Inject overlay before closing View
  let overlayCode = `
      {showSuccess && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <View style={{ backgroundColor: theme['surface-container'] || theme.card || '#2a2d3a', padding: 32, borderRadius: 20, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={72} color={theme.tertiary || theme.primary || '#65d9a5'} />
            <Text style={{ color: theme['on-surface'] || theme.text || '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 16 }}>Successfully Added!</Text>
          </View>
        </View>
      )}
    </View>
  );
};`;
  content = content.replace(/    <\/View>\n  \);\n};\n/g, overlayCode);

  fs.writeFileSync(file, content);
  console.log('StickerPicker.js patched with Success UI');
}

patchStickerEditorScreen();
patchStickerPicker();
