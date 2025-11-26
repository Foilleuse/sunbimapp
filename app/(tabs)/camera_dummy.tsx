import { View } from 'react-native';

/**
 * Ce composant est un "Leurre".
 * Il ne s'affiche jamais car le _layout.tsx intercepte le clic
 * et redirige vers la page d'accueil (Index).
 * Mais il doit exister pour que le Routeur ne plante pas.
 */
export default function CameraDummyPage() {
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}