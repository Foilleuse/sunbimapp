import { View, Text, StyleSheet } from 'react-native';

export default function GalleryPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Recherche (Bientôt)</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '600' }
});