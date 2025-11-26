import { View, Text, StyleSheet } from 'react-native';

export default function MessagesPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Messagerie (Bientôt)</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '600' }
});