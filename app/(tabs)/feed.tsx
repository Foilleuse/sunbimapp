import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { X, Send, User } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  drawingId: string;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ visible, onClose, drawingId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible && drawingId) fetchComments();
  }, [visible, drawingId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, users(display_name, avatar_url)')
        .eq('drawing_id', drawingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newComment.trim()) return;
    if (!user) {
        Alert.alert("Erreur", "Tu dois être connecté pour commenter.");
        return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({ 
            user_id: user.id, 
            drawing_id: drawingId, 
            content: newComment.trim() 
        });
      
      if (error) throw error;

      setNewComment('');
      Keyboard.dismiss();
      fetchComments(); 
      
    } catch (e: any) {
      Alert.alert("Erreur Envoi", e.message);
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: any }) => (
    <View style={styles.commentItem}>
        <View style={styles.avatarContainer}>
            {item.users?.avatar_url ? (
                <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}><User size={12} color="#666"/></View>
            )}
        </View>
        <View style={styles.bubble}>
            <Text style={styles.author}>{item.users?.display_name || 'Anonyme'}</Text>
            <Text style={styles.content}>{item.content}</Text>
        </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Commentaires</Text>
                <TouchableOpacity onPress={onClose} hitSlop={10}><X color="#000" size={24}/></TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={{marginTop: 20}} color="#000"/>
            ) : (
                <FlatList
                    data={comments}
                    renderItem={renderComment}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
                    ListEmptyComponent={<Text style={styles.empty}>Soyez le premier à commenter !</Text>}
                    inverted={false} 
                />
            )}

            <View style={styles.inputBar}>
                <TextInput 
                    style={styles.input} 
                    placeholder={user ? "Ajouter un commentaire..." : "Connecte-toi pour commenter"}
                    value={newComment}
                    onChangeText={setNewComment}
                    editable={!!user}
                    multiline
                    maxLength={150}
                />
                <TouchableOpacity 
                    onPress={handleSend} 
                    disabled={!user || sending || !newComment.trim()}
                    style={styles.sendBtn}
                >
                    {sending ? <ActivityIndicator color="#000" size="small"/> : <Send color={(!user || !newComment.trim()) ? "#CCC" : "#000"} size={24} />}
                </TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#F0F0F0', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 'bold' },
  commentItem: { flexDirection: 'row', marginBottom: 15 },
  avatarContainer: { marginRight: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  bubble: { flex: 1, backgroundColor: '#F9F9F9', padding: 10, borderRadius: 12 },
  author: { fontWeight: '700', fontSize: 12, marginBottom: 2 },
  content: { fontSize: 14 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
  inputBar: { 
      flexDirection: 'row', 
      padding: 10, 
      borderTopWidth: 1, 
      borderColor: '#F0F0F0', 
      alignItems: 'flex-end', 
      backgroundColor: '#FFF',
      paddingBottom: Platform.OS === 'ios' ? 20 : 10 
  },
  input: { 
      flex: 1, 
      backgroundColor: '#F5F5F5', 
      borderRadius: 20, 
      paddingHorizontal: 15, 
      paddingTop: 10, 
      paddingBottom: 10,
      minHeight: 40, 
      maxHeight: 100,
      marginRight: 10,
      fontSize: 14
  },
  sendBtn: {
      height: 40,
      justifyContent: 'center',
      alignItems: 'center'
  }
});