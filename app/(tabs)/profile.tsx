import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable, KeyboardAvoidingView, Platform, SafeAreaView, PixelRatio, ScrollView } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { User, Mail, Lock, X, Heart, MessageCircle, AlertCircle, Settings, Lightbulb, Palette, Zap, MoreHorizontal, Unlock } from 'lucide-react-native'; 
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SettingsModal } from '../../src/components/SettingsModal'; 
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
// Import de la nouvelle modale
import { DrawingDetailModal } from '../../src/components/DrawingDetailModal';
// Imports pour le flou et la safe area
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  // Gestion du header flouté
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(100);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 2; 
  const ITEM_SIZE = (screenWidth - (SPACING * (NUM_COLS - 1))) / NUM_COLS;

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: allClouds, error: cloudsError } = await supabase
            .from('clouds')
            .select('*')
            .lte('published_for', today)
            .order('published_for', { ascending: false });

        if (cloudsError) throw cloudsError;

        const { data: userDrawings, error: drawingsError } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id)
            .eq('is_hidden', false);

        if (drawingsError) throw drawingsError;

        const combinedHistory = allClouds?.map(cloud => {
            const drawing = userDrawings?.find(d => d.cloud_id === cloud.id);
            if (drawing) {
                return { ...drawing, type: 'drawing', id: drawing.id }; 
            } else {
                return { 
                    id: `missed-${cloud.id}`, 
                    type: 'missed', 
                    cloud_image_url: cloud.image_url, 
                    date: cloud.published_for 
                };
            }
        }) || [];

        setHistoryItems(combinedHistory);

    } catch (e) {
        console.error(e);
    } finally {
        setLoadingHistory(false);
    }
  };

  const handleAuth = async () => {
      if (!email || !password) return Alert.alert("Error", "Fill in all fields");
      setAuthActionLoading(true);
      try {
          const { error } = isSignUp 
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
      } catch (e: any) {
          Alert.alert("Error", e.message);
      } finally {
          setAuthActionLoading(false);
      }
  };

  const openDrawing = (drawing: any) => setSelectedDrawing(drawing);
  
  const closeDrawing = () => {
      setSelectedDrawing(null);
  };

  const renderItem = ({ item }: { item: any }) => {
      // Optimisation grille
      const thumbW = Math.round(ITEM_SIZE * PixelRatio.get());
      const thumbH = Math.round(thumbW * (4/3));
      const thumbOptimized = getOptimizedImageUrl(item.cloud_image_url, thumbW, thumbH);

      if (item.type === 'missed') {
          return (
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => Alert.alert("Day missed", "You didn't draw that day.")}
                style={{ width: ITEM_SIZE, aspectRatio: 3/4, marginBottom: SPACING, backgroundColor: '#EEE', position: 'relative' }}
            >
                <Image 
                    source={{ uri: thumbOptimized || item.cloud_image_url }} 
                    style={{ width: '100%', height: '100%', opacity: 0.6 }} 
                    resizeMode="cover" 
                />
                <View style={styles.missedOverlay}>
                    <AlertCircle color="#000" size={32} style={{ marginBottom: 5 }} />
                    <Text style={styles.missedDate}>
                        {new Date(item.date).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                    </Text>
                </View>
            </TouchableOpacity>
          );
      }

      return (
        <TouchableOpacity 
            onPress={() => openDrawing(item)} 
            style={{ 
                width: ITEM_SIZE, 
                aspectRatio: 3/4, 
                marginBottom: SPACING, 
                backgroundColor: '#F9F9F9', 
                overflow: 'hidden' 
            }}
        >
            <DrawingViewer 
                imageUri={thumbOptimized || item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                viewerHeight={ITEM_SIZE * (4/3)} 
                transparentMode={false}
                animated={false}
                startVisible={true}
                autoCenter={false} 
            />
        </TouchableOpacity>
      );
  };

  // --- Composant d'entête de liste (Infos Profil) ---
  const ListHeader = useMemo(() => {
      return (
        <View style={styles.profileBlock}>
            <View style={styles.profileInfoContainer}>
                {profile?.avatar_url ? (
                    <Image 
                        source={{ uri: profile.avatar_url }} 
                        style={styles.profileAvatar} 
                    />
                ) : (
                    <View style={[styles.profileAvatar, styles.placeholderAvatar]}>
                        <User color="#666" size={35} />
                    </View>
                )}
                
                <View style={styles.profileTextContainer}>
                    <Text style={styles.displayName}>{profile?.display_name || "Anonymous"}</Text>
                    <Text style={styles.bio} numberOfLines={3}>
                        {profile?.bio || "No bio yet."}
                    </Text>
                </View>

                <View style={{ marginLeft: 10 }}>
                    <TouchableOpacity 
                        style={styles.iconOnlyBtn} 
                        onPress={() => setShowSettings(true)}
                    >
                        <Settings color="#000" size={20} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      );
  }, [profile]);

  if (!user) {
      return (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
              {/* Header Authentification (non flouté pour rester simple sur la page de login) */}
              <SunbimHeader showCloseButton={false} />
              
              <View style={styles.authContainer}>
                  <View style={styles.logoContainer}>
                      <Text style={styles.authTitle}>Profile</Text>
                      <Text style={styles.authSubtitle}>Log in to find your drawings.</Text>
                  </View>
                  <View style={styles.inputGroup}>
                      <Mail color="#999" size={20} style={styles.inputIcon} />
                      <TextInput placeholder="Email" style={styles.input} placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" />
                  </View>
                  <View style={styles.inputGroup}>
                      <Lock color="#999" size={20} style={styles.inputIcon} />
                      <TextInput placeholder="Password" style={styles.input} placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} />
                  </View>
                  <TouchableOpacity style={styles.authBtn} onPress={handleAuth} disabled={authActionLoading}>
                      {authActionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.authBtnText}>{isSignUp ? "Sign Up" : "Log In"}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                      <Text style={styles.switchText}>{isSignUp ? "I already have an account" : "Create an account"}</Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      );
  }

  return (
    <View style={styles.container}>
      {/* 1. Liste Principale (défile sous le header) */}
      <View style={{flex: 1}}>
          {loadingHistory ? (
              <ActivityIndicator style={{marginTop: headerHeight + 20}} />
          ) : (
              <FlatList
                data={historyItems}
                numColumns={NUM_COLS}
                // Header du profil intégré au scroll
                ListHeaderComponent={ListHeader}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                columnWrapperStyle={{ gap: SPACING }}
                // Padding dynamique pour le header et la bottom bar
                contentContainerStyle={{ 
                    paddingTop: headerHeight, 
                    paddingBottom: 100 
                }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <AlertCircle color="#CCC" size={40} />
                        <Text style={styles.emptyText}>No activity yet.</Text>
                    </View>
                }
              />
          )}
      </View>

      {/* 2. Header Flouté Absolu */}
      <BlurView 
          intensity={80} 
          tint="light" 
          style={[styles.absoluteHeader, { paddingTop: insets.top }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
          <SunbimHeader showCloseButton={false} transparent={true} />
          {/* Ligne de séparation subtile */}
          <View style={styles.headerSeparator} />
      </BlurView>

      {/* MODALE D'AGRANDISSEMENT VIA COMPOSANT */}
      {selectedDrawing && (
          <DrawingDetailModal
              visible={!!selectedDrawing}
              onClose={closeDrawing}
              drawing={selectedDrawing}
              userProfile={profile} // On passe le profil connecté
              isUnlocked={true} // C'est mon profil, donc débloqué
          />
      )}

      <SettingsModal 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  
  // Header Absolu
  absoluteHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
  },
  headerSeparator: {
      height: 1,
      backgroundColor: 'rgba(0,0,0,0.05)',
      width: '100%',
  },

  profileBlock: { 
      paddingTop: 10, 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#FFF'
  },
  
  profileInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      // Pas de marginBottom ici, géré par le padding du bloc ou le gap
  },
  profileAvatar: { 
      width: 80, 
      height: 80, 
      borderRadius: 40,
      marginRight: 15 
  },
  placeholderAvatar: { 
      backgroundColor: '#F0F0F0', 
      justifyContent: 'center', 
      alignItems: 'center' 
  },
  profileTextContainer: {
      flex: 1,
      justifyContent: 'center'
  },
  displayName: { 
      fontSize: 22, 
      fontWeight: '900', 
      color: '#000',
      marginBottom: 4
  },
  bio: { 
      fontSize: 14, 
      color: '#666',
      lineHeight: 20
  },

  iconOnlyBtn: {
      width: 44, 
      height: 44, 
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F5',
      borderRadius: 12,
  },
  
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999', marginTop: 10 },
  
  missedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)' },
  missedDate: { fontSize: 16, fontWeight: '700', color: '#000', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },

  authContainer: { flex: 1, justifyContent: 'center', padding: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  authTitle: { fontSize: 32, fontWeight: '900', color: '#000', marginBottom: 10 },
  authSubtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 15, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#EEE' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#000' },
  authBtn: { backgroundColor: '#000', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },
});