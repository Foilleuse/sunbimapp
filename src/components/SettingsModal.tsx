import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Save, LogOut, Trash2, Camera, Lock, User } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router'; // Import du router pour la redirection

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { user, profile, signOut } = useAuth();
  const router = useRouter(); // Initialisation du router
  
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);

  // Initialisation des champs avec les données actuelles
  useEffect(() => {
    if (visible && profile) {
        setDisplayName(profile.display_name || '');
        setBio(profile.bio || '');
        setPassword(''); 
    }
  }, [visible, profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
        const updates = {
            id: user.id,
            display_name: displayName,
            bio: bio,
            updated_at: new Date(),
        };

        const { error } = await supabase
            .from('users') 
            .upsert(updates);

        if (error) throw error;

        Alert.alert("Succès", "Profil mis à jour !");
    } catch (error: any) {
        Alert.alert("Erreur", error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
      if (!password) return Alert.alert("Erreur", "Veuillez entrer un nouveau mot de passe.");
      setLoading(true);
      try {
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
          Alert.alert("Succès", "Mot de passe modifié !");
          setPassword('');
      } catch (error: any) {
          Alert.alert("Erreur", error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSignOut = async () => {
      try {
          await signOut();
          onClose(); // Ferme la modale
          router.replace('/'); // Redirection vers l'index (Page d'accueil/Dessin)
      } catch (error) {
          console.error(error);
      }
  };

  const handleDeleteAccount = () => {
      Alert.alert(
          "Supprimer le compte",
          "Êtes-vous sûr ? Cette action est irréversible et effacera toutes vos données.",
          [
              { text: "Annuler", style: "cancel" },
              { 
                  text: "Supprimer", 
                  style: "destructive", 
                  onPress: async () => {
                      try {
                          // Note: Nécessite une fonction RPC 'delete_user' configurée côté Supabase
                          // ou une logique backend pour supprimer l'user auth.
                          const { error } = await supabase.rpc('delete_user'); 
                          if (error) throw error;
                          
                          await signOut();
                          onClose();
                          router.replace('/');
                      } catch (e: any) {
                          Alert.alert("Erreur", "Impossible de supprimer le compte. Contactez le support.");
                          console.error(e);
                      }
                  }
              }
          ]
      );
  };

  const handleChangeAvatar = () => {
      Alert.alert("Info", "La modification de l'avatar nécessite l'accès à la galerie (bientôt disponible).");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
            <Text style={styles.title}>Paramètres</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X color="#000" size={24} />
            </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
            
            {/* SECTION PROFIL */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Profil</Text>
                
                <TouchableOpacity style={styles.avatarBtn} onPress={handleChangeAvatar}>
                    <View style={styles.avatarPlaceholder}>
                        <Camera color="#666" size={24} />
                    </View>
                    <Text style={styles.avatarText}>Changer la photo</Text>
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Pseudo</Text>
                    <TextInput 
                        style={styles.input} 
                        value={displayName} 
                        onChangeText={setDisplayName} 
                        placeholder="Votre pseudo"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput 
                        style={[styles.input, styles.textArea]} 
                        value={bio} 
                        onChangeText={setBio} 
                        placeholder="Parlez de vous..."
                        multiline
                        numberOfLines={3}
                    />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : (
                        <>
                            <Save color="#FFF" size={18} />
                            <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* SECTION SÉCURITÉ */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sécurité</Text>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nouveau mot de passe</Text>
                    <TextInput 
                        style={styles.input} 
                        value={password} 
                        onChangeText={setPassword} 
                        placeholder="••••••••"
                        secureTextEntry
                    />
                </View>
                <TouchableOpacity style={styles.passwordBtn} onPress={handleUpdatePassword} disabled={loading || !password}>
                    <Lock color="#000" size={16} />
                    <Text style={styles.passwordBtnText}>Mettre à jour le mot de passe</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* SECTION DANGER */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
                    <LogOut color="#000" size={18} />
                    <Text style={styles.logoutText}>Se déconnecter</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
                    <Trash2 color="#FF3B30" size={18} />
                    <Text style={styles.deleteText}>Supprimer le compte</Text>
                </TouchableOpacity>
            </View>
            
            <View style={{height: 50}} /> 
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 5, backgroundColor: '#F2F2F7', borderRadius: 20 },
  content: { padding: 20 },
  
  section: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#000' },
  
  avatarBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#007AFF', fontSize: 16 },

  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#F9F9F9', borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  textArea: { height: 80, textAlignVertical: 'top' },

  saveBtn: { backgroundColor: '#000', borderRadius: 8, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 5 },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },

  passwordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8 },
  passwordBtnText: { fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#E5E5EA', marginBottom: 20 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 },
  logoutText: { fontSize: 16, fontWeight: '500', color: '#000' },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 10 },
  deleteText: { fontSize: 16, fontWeight: '500', color: '#FF3B30' }
});