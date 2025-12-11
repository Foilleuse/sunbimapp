import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Alert, ActivityIndicator, Switch, ScrollView, TextInput, Platform } from 'react-native';
import { X, LogOut, Camera, User, ChevronRight, Bell, Shield, CircleHelp, Trash2, Lock, Save } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // --- CONFIGURATION GOOGLE SIGNIN ---
  useEffect(() => {
    try {
        GoogleSignin.configure({
            iosClientId: 'VOTRE_IOS_CLIENT_ID_GOOGLE.apps.googleusercontent.com',
            webClientId: 'VOTRE_WEB_CLIENT_ID_GOOGLE.apps.googleusercontent.com', 
            scopes: ['profile', 'email'],
        });
    } catch (e) {
        console.log("Erreur config Google Signin (ignorer si non configuré):", e);
    }
  }, []);

  // --- GESTION PHOTO DE PROFIL ---
  const handleAvatarPress = () => {
      Alert.alert(
          "Modifier la photo",
          "Choisissez une source",
          [
              { text: "Annuler", style: "cancel" },
              { text: "Prendre une photo", onPress: handleTakePhoto },
              { text: "Choisir dans la galerie", onPress: handlePickImage },
          ]
      );
  };

  const handleTakePhoto = async () => {
      try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire.");
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
          Alert.alert('Erreur', 'Impossible de lancer la caméra.');
      }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission requise", "L'accès à la galerie est nécessaire.");
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
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
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
                 throw new Error("Le bucket 'avatars' n'existe pas ou est mal configuré.");
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

        Alert.alert("Succès", "Photo de profil mise à jour !");
    } catch (error: any) {
        console.error("Erreur upload complète:", error);
        Alert.alert("Erreur", "Echec de l'upload : " + (error.message || "Erreur inconnue"));
    } finally {
        setLoading(false);
    }
  };

  // --- SOCIAL LOGIN (POUR LINKER UN COMPTE) ---
  const linkGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.idToken,
        });
        if (error) throw error;
        Alert.alert("Succès", "Compte Google lié !");
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      } else if (error.code === statusCodes.IN_PROGRESS) {
      } else {
        Alert.alert("Erreur Google", error.message);
      }
    }
  };

  const linkApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
        Alert.alert("Succès", "Compte Apple lié !");
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
      } else {
        Alert.alert("Erreur Apple", e.message);
      }
    }
  };


  // --- GESTION MOT DE PASSE ---
  const handleUpdatePassword = async () => {
      if (newPassword.length < 6) {
          Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères.");
          return;
      }
      setLoading(true);
      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          
          Alert.alert("Succès", "Votre mot de passe a été modifié.");
          setNewPassword('');
          setIsChangingPassword(false);
      } catch (error: any) {
          Alert.alert("Erreur", error.message);
      } finally {
          setLoading(false);
      }
  };

  // --- GESTION SUPPRESSION COMPTE ---
  const handleDeleteAccount = () => {
      Alert.alert(
          "Supprimer mon compte",
          "Attention : Cette action est définitive. Toutes vos données seront effacées.",
          [
              { text: "Annuler", style: "cancel" },
              { 
                  text: "Supprimer définitivement", 
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
              throw new Error("Impossible de supprimer les données. Contactez le support.");
          }

          await signOut();
          onClose(); 
          router.replace('/');
          Alert.alert("Compte supprimé", "Vos données ont été effacées. Au revoir.");
      } catch (error: any) {
          Alert.alert("Erreur", error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleLogout = () => {
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
                      router.replace('/'); 
                  } 
              }
          ]
      );
  };

  const currentAvatar = profile?.avatar_url ? getOptimizedImageUrl(profile.avatar_url, 100) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            
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
                            <Text style={styles.name}>{profile?.display_name || "Utilisateur"}</Text>
                            <Text style={styles.email}>{user?.email}</Text>
                        </View>
                    </View>
                </View>

                {/* SECTION COMPTES LIÉS */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>COMPTES LIÉS</Text>
                </View>
                <View style={styles.menuContainer}>
                    <TouchableOpacity style={styles.menuItem} onPress={linkGoogle}>
                        <View style={styles.menuIconContainer}>
                            <View style={{width:20, height:20, borderRadius:10, backgroundColor:'#DB4437', justifyContent:'center', alignItems:'center'}}>
                                <Text style={{color:'#FFF', fontWeight:'bold', fontSize:10}}>G</Text>
                            </View>
                        </View>
                        <Text style={styles.menuText}>Google</Text>
                        <ChevronRight size={20} color="#CCC" />
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                        <TouchableOpacity style={styles.menuItem} onPress={linkApple}>
                            <View style={styles.menuIconContainer}>
                                <View style={{width:20, height:20, borderRadius:10, backgroundColor:'#000', justifyContent:'center', alignItems:'center'}}>
                                    <Text style={{color:'#FFF', fontWeight:'bold', fontSize:10}}></Text>
                                </View>
                            </View>
                            <Text style={styles.menuText}>Apple</Text>
                            <ChevronRight size={20} color="#CCC" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* SECTION SECURITE */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>SÉCURITÉ</Text>
                </View>
                <View style={styles.menuContainer}>
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => setIsChangingPassword(!isChangingPassword)}
                    >
                        <View style={styles.menuIconContainer}>
                            <Lock size={20} color="#000" />
                        </View>
                        <Text style={styles.menuText}>Changer de mot de passe</Text>
                        <ChevronRight size={20} color={isChangingPassword ? "#000" : "#CCC"} transform={isChangingPassword ? [{rotate: '90deg'}] : []} />
                    </TouchableOpacity>

                    {isChangingPassword && (
                        <View style={styles.passwordForm}>
                            <TextInput 
                                style={styles.passwordInput}
                                placeholder="Nouveau mot de passe (min 6 car.)"
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
                                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
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

                {/* SECTION DANGER */}
                <View style={styles.sectionTitleContainer}>
                    <Text style={[styles.sectionTitle, {color: '#FF3B30'}]}>ZONE DE DANGER</Text>
                </View>

                <TouchableOpacity style={[styles.menuContainer, styles.logoutBtn]} onPress={handleLogout}>
                    <LogOut size={20} color="#000" />
                    <Text style={[styles.logoutText, {color: '#000'}]}>Se déconnecter</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuContainer, styles.logoutBtn, { borderColor: '#FF3B30', borderTopWidth: 1 }]} onPress={handleDeleteAccount}>
                    <Trash2 size={20} color="#FF3B30" />
                    <Text style={styles.logoutText}>Supprimer mon compte</Text>
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
  
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { 
      position: 'absolute', bottom: 0, right: 0, backgroundColor: '#000', 
      width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: '#FFF'
  },
  profileInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  email: { fontSize: 14, color: '#8E8E93' },

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