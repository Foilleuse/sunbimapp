import { View, Text, StyleSheet } from 'react-native';

export default function StatsPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Statistiques (Bientôt)</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '600' }
});