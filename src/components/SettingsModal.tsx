import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Alert, ActivityIndicator, Switch, ScrollView, TextInput, Platform } from 'react-native';
import { X, LogOut, Camera, User, ChevronRight, Bell, Trash2, Lock } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
// ✅ Import conservé comme demandé
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { useRouter } from 'expo-router';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // --- NOUVEAUX ÉTATS POUR LE PROFIL ---
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // --- SYNCHRONISATION INITIALE DU PROFIL ---
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  // --- GESTION MISE A JOUR TEXTE PROFIL ---
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName,
          bio: bio,
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- GESTION PHOTO DE PROFIL ---
  const handleAvatarPress = () => {
      Alert.alert(
          "Change Photo",
          "Choose a source",
          [
              { text: "Cancel", style: "cancel" },
              { text: "Take a photo", onPress: handleTakePhoto },
              { text: "Choose from gallery", onPress: handlePickImage },
          ]
      );
  };

  const handleTakePhoto = async () => {
      try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert("Permission denied", "Camera access is required.");
              return;
          }

          const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
              base64: true, // ✅ IMPORTANT: On demande le base64 pour l'upload ArrayBuffer
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              if (asset.base64) {
                  uploadAvatar(asset.base64, asset.mimeType || 'image/jpeg');
              }
          }
      } catch (error) {
          Alert.alert('Error', 'Could not launch camera.');
      }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Gallery access is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], 
        quality: 0.5, 
        base64: true, // ✅ IMPORTANT: On demande le base64 pour l'upload ArrayBuffer
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
             uploadAvatar(asset.base64, asset.mimeType || 'image/jpeg');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open gallery.');
    }
  };

  const uploadAvatar = async (base64Data: string, mimeType: string) => {
    if (!user) return;
    setLoading(true);
    
    try {
        const fileName = `${user.id}/${new Date().getTime()}.jpg`;

        // 1. Conversion Base64 -> ArrayBuffer (Méthode robuste pour React Native + Supabase)
        const arrayBuffer = decode(base64Data);

        // 2. Upload vers Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, { 
                contentType: mimeType || 'image/jpeg', 
                upsert: true 
            });

        if (uploadError) {
             if (uploadError.message.includes("bucket")) {
                 throw new Error("The 'avatars' bucket does not exist or is misconfigured.");
             }
             throw uploadError;
        }

        // 3. Récupération de l'URL publique
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        
        // 4. Mise à jour du profil utilisateur
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: data.publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        Alert.alert("Success", "Profile photo updated!");
    } catch (error: any) {
        console.error("Erreur upload complète:", error);
        Alert.alert("Error", "Upload failed: " + (error.message || "Unknown error"));
    } finally {
        setLoading(false);
    }
  };

  // --- GESTION MOT DE PASSE ---
  const handleUpdatePassword = async () => {
      if (newPassword.length < 6) {
          Alert.alert("Error", "Password must be at least 6 characters.");
          return;
      }
      setLoading(true);
      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          
          Alert.alert("Success", "Your password has been changed.");
          setNewPassword('');
          setIsChangingPassword(false);
      } catch (error: any) {
          Alert.alert("Error", error.message);
      } finally {
          setLoading(false);
      }
  };

  // --- GESTION SUPPRESSION COMPTE ---
  const handleDeleteAccount = () => {
      Alert.alert(
          "Delete Account",
          "Warning: This action is permanent. All your data will be erased.",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete Permanently", 
                  style: "destructive",
                  onPress: confirmDeleteAccount
              }
          ]
      );
  };

  const confirmDeleteAccount = async () => {
      if (!user) return;
      setLoading(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', user.id);
          
          if (error) {
              console.error("Erreur suppression data:", error);
              throw new Error("Could not delete data. Please contact support.");
          }

          await signOut();
          onClose(); 
          router.replace('/');
          Alert.alert("Account Deleted", "Your data has been erased. Goodbye.");
      } catch (error: any) {
          Alert.alert("Error", error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleLogout = () => {
      Alert.alert(
          "Log Out",
          "Are you sure you want to log out?",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Log Out", 
                  style: "destructive", 
                  onPress: async () => { 
                      await signOut(); 
                      onClose(); 
                      router.replace('/'); 
                  } 
              }
          ]
      );
  };

  // ✅ MODIFICATION : Utilisation directe de l'URL sans passer par l'optimiseur
  const currentAvatar = profile?.avatar_url || null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X color="#000" size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* SECTION PROFIL */}
                <View style={styles.section}>
                    <View style={styles.profileHeader}>
                        <TouchableOpacity onPress={handleAvatarPress} disabled={loading} style={styles.avatarContainer}>
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
                            {/* Inputs modifiables */}
                            <Text style={styles.label}>Display Name</Text>
                            <TextInput
                                value={displayName}
                                onChangeText={setDisplayName}
                                style={styles.input}
                                placeholder="Display Name"
                            />
                            
                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                value={bio}
                                onChangeText={setBio}
                                style={[styles.input, styles.bioInput]}
                                placeholder="Your bio..."
                                multiline
                                numberOfLines={3}
                            />
                            
                            <Text style={styles.email}>{user?.email}</Text>

                            <TouchableOpacity 
                                style={styles.saveProfileBtn} 
                                onPress={handleSaveProfile}
                                disabled={isSavingProfile}
                            >
                                {isSavingProfile ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.saveProfileText}>Save Profile</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* SECTION SECURITE */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>SECURITY</Text>
                </View>
                <View style={styles.menuContainer}>
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => setIsChangingPassword(!isChangingPassword)}
                    >
                        <View style={styles.menuIconContainer}>
                            <Lock size={20} color="#000" />
                        </View>
                        <Text style={styles.menuText}>Change Password</Text>
                        <ChevronRight size={20} color={isChangingPassword ? "#000" : "#CCC"} transform={isChangingPassword ? [{rotate: '90deg'}] : []} />
                    </TouchableOpacity>

                    {isChangingPassword && (
                        <View style={styles.passwordForm}>
                            <TextInput 
                                style={styles.passwordInput}
                                placeholder="New password (min 6 chars)"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholderTextColor="#999"
                            />
                            <TouchableOpacity 
                                style={[styles.saveBtn, { opacity: newPassword.length < 6 ? 0.5 : 1 }]}
                                onPress={handleUpdatePassword}
                                disabled={newPassword.length < 6 || loading}
                            >
                                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* SECTION PREFERENCES */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>PREFERENCES</Text>
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

                {/* SECTION DANGER */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={[styles.sectionTitle, {color: '#FF3B30'}]}>DANGER ZONE</Text>
                </View>

                <TouchableOpacity style={[styles.menuContainer, styles.logoutBtn]} onPress={handleLogout}>
                    <LogOut size={20} color="#000" />
                    <Text style={[styles.logoutText, {color: '#000'}]}>Log Out</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuContainer, styles.logoutBtn, { borderColor: '#FF3B30', borderTopWidth: 1 }]} onPress={handleDeleteAccount}>
                    <Trash2 size={20} color="#FF3B30" />
                    <Text style={styles.logoutText}>Delete Account</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Version 1.0.0</Text>

            </ScrollView>
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { 
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
      paddingVertical: 15, backgroundColor: '#FFF',
      borderBottomWidth: 1, borderBottomColor: '#E5E5EA'
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { position: 'absolute', right: 15, padding: 5 },
  
  scrollContent: { paddingVertical: 20 },

  section: { 
      backgroundColor: '#FFF', paddingVertical: 20, paddingHorizontal: 15, marginBottom: 20,
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E5EA'
  },
  
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start' }, // Changed to flex-start for form alignment
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { 
      position: 'absolute', bottom: 0, right: 0, backgroundColor: '#000', 
      width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: '#FFF'
  },
  profileInfo: { flex: 1 },
  // Styles modifiés pour le formulaire
  label: { fontSize: 12, color: '#8E8E93', marginBottom: 4, marginTop: 4 },
  input: {
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5EA',
      paddingVertical: 4,
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
      color: '#000'
  },
  bioInput: {
      height: 60,
      textAlignVertical: 'top' // Android fix for multiline
  },
  saveProfileBtn: {
      backgroundColor: '#000',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignSelf: 'flex-start',
      marginTop: 10
  },
  saveProfileText: {
      color: '#FFF',
      fontWeight: '600',
      fontSize: 14
  },
  email: { fontSize: 14, color: '#8E8E93', marginTop: 4 },

  sectionTitleContainer: { paddingHorizontal: 15, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },

  menuContainer: { 
      backgroundColor: '#FFF', marginBottom: 25,
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E5EA'
  },
  menuItem: { 
      flexDirection: 'row', alignItems: 'center', 
      paddingVertical: 12, paddingHorizontal: 15 
  },
  menuIconContainer: { marginRight: 15 },
  menuText: { flex: 1, fontSize: 16 },
  
  passwordForm: {
      padding: 15,
      backgroundColor: '#F9F9F9',
      borderTopWidth: 1,
      borderTopColor: '#EEE'
  },
  passwordInput: {
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#DDD',
      borderRadius: 8,
      padding: 10,
      fontSize: 16,
      marginBottom: 10
  },
  saveBtn: {
      backgroundColor: '#000',
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center'
  },
  saveBtnText: { color: '#FFF', fontWeight: '600' },

  logoutBtn: { 
      flexDirection: 'row', alignItems: 'center', 
      paddingVertical: 15, paddingHorizontal: 15, gap: 10, marginBottom: 0 
  },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },

  version: { textAlign: 'center', color: '#C7C7CC', fontSize: 12, marginTop: 10, marginBottom: 30 }
});