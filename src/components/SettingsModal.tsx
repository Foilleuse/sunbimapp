import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Alert, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { X, LogOut, Camera, User, ChevronRight, Bell, Shield, CircleHelp } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { user, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // --- GESTION PHOTO DE PROFIL ---
  const handlePickImage = async () => {
    try {
      // Demander la permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permission requise", "L'accès à la galerie est nécessaire pour changer votre photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Carré parfait pour l'avatar
        quality: 0.5, // Compression pour upload rapide
        base64: true, // Nécessaire pour l'upload Supabase via arraybuffer
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
            uploadAvatar(asset.base64);
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
    }
  };

  const uploadAvatar = async (base64Data: string) => {
    if (!user) return;
    setLoading(true);
    
    try {
        const fileName = `${user.id}/${new Date().getTime()}.jpg`;
        const contentType = 'image/jpeg';

        // 1. Upload vers Supabase Storage (Bucket 'avatars')
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, decode(base64Data), { 
                contentType,
                upsert: true 
            });

        if (uploadError) throw uploadError;

        // 2. Récupérer l'URL publique
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const publicUrl = data.publicUrl;

        // 3. Mettre à jour le profil utilisateur
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        Alert.alert("Succès", "Photo de profil mise à jour !");
    } catch (error: any) {
        console.error(error);
        Alert.alert("Erreur", "Echec de l'upload. Vérifiez votre connexion.");
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = async () => {
      Alert.alert(
          "Déconnexion",
          "Êtes-vous sûr de vouloir vous déconnecter ?",
          [
              { text: "Annuler", style: "cancel" },
              { 
                  text: "Se déconnecter", 
                  style: "destructive",
                  onPress: async () => {
                      await signOut();
                      onClose();
                  }
              }
          ]
      );
  };

  const currentAvatar = profile?.avatar_url 
    ? getOptimizedImageUrl(profile.avatar_url, 100) 
    : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Paramètres</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X color="#000" size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* SECTION PROFIL */}
                <View style={styles.section}>
                    <View style={styles.profileHeader}>
                        <TouchableOpacity onPress={handlePickImage} disabled={loading} style={styles.avatarContainer}>
                            {currentAvatar ? (
                                <Image source={{ uri: currentAvatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.placeholderAvatar]}>
                                    <User size={40} color="#999" />
                                </View>
                            )}
                            <View style={styles.cameraBadge}>
                                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Camera size={14} color="#FFF" />}
                            </View>
                        </TouchableOpacity>
                        
                        <View style={styles.profileInfo}>
                            <Text style={styles.name}>{profile?.display_name || "Utilisateur"}</Text>
                            <Text style={styles.email}>{user?.email}</Text>
                        </View>
                    </View>
                </View>

                {/* SECTION PREFERENCES */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>PRÉFÉRENCES</Text>
                </View>
                
                <View style={styles.menuContainer}>
                    <View style={styles.menuItem}>
                        <View style={styles.menuIconContainer}>
                            <Bell size={20} color="#000" />
                        </View>
                        <Text style={styles.menuText}>Notifications</Text>
                        <Switch 
                            value={notificationsEnabled} 
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: "#E0E0E0", true: "#000" }}
                        />
                    </View>
                </View>

                {/* SECTION SUPPORT */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>SUPPORT</Text>
                </View>

                <View style={styles.menuContainer}>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIconContainer}>
                            <Shield size={20} color="#000" />
                        </View>
                        <Text style={styles.menuText}>Confidentialité</Text>
                        <ChevronRight size={20} color="#CCC" />
                    </TouchableOpacity>
                    
                    <View style={styles.separator} />

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIconContainer}>
                            <CircleHelp size={20} color="#000" />
                        </View>
                        <Text style={styles.menuText}>Aide & Support</Text>
                        <ChevronRight size={20} color="#CCC" />
                    </TouchableOpacity>
                </View>

                {/* SECTION DANGER */}
                <TouchableOpacity style={[styles.menuContainer, styles.logoutBtn]} onPress={handleLogout}>
                    <LogOut size={20} color="#FF3B30" />
                    <Text style={styles.logoutText}>Se déconnecter</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Version 1.0.0 (Build 18)</Text>

            </ScrollView>
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' }, // Fond gris clair style iOS
  header: { 
      flexDirection: 'row', 
      justifyContent: 'center', 
      alignItems: 'center', 
      paddingVertical: 15, 
      backgroundColor: '#FFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5EA'
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { position: 'absolute', right: 15, padding: 5 },
  
  scrollContent: { paddingVertical: 20 },

  section: { 
      backgroundColor: '#FFF', 
      paddingVertical: 20, 
      paddingHorizontal: 15, 
      marginBottom: 20,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#E5E5EA'
  },
  
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { 
      position: 'absolute', 
      bottom: 0, 
      right: 0, 
      backgroundColor: '#000', 
      width: 24, 
      height: 24, 
      borderRadius: 12, 
      justifyContent: 'center', 
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFF'
  },
  profileInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  email: { fontSize: 14, color: '#8E8E93' },

  sectionTitleContainer: { paddingHorizontal: 15, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },

  menuContainer: { 
      backgroundColor: '#FFF', 
      marginBottom: 25,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#E5E5EA'
  },
  menuItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingVertical: 12, 
      paddingHorizontal: 15 
  },
  menuIconContainer: { marginRight: 15 },
  menuText: { flex: 1, fontSize: 16 },
  separator: { height: 1, backgroundColor: '#E5E5EA', marginLeft: 50 },

  logoutBtn: { justifyContent: 'center', gap: 10, marginTop: 10 },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },

  version: { textAlign: 'center', color: '#C7C7CC', fontSize: 12, marginTop: 10 }
});