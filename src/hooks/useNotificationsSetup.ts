import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Définir comment l'app réagit aux notifications quand elle est ouverte (au premier plan)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Afficher l'alerte même si l'app est ouverte
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotificationsSetup() {
  useEffect(() => {
    configureNotifications();
  }, []);

  const configureNotifications = async () => {
    // A. Demander les permissions à l'utilisateur
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission de notification refusée !');
      return;
    }

    // B. Nettoyage : On annule tout pour éviter d'empiler les notifications si l'app redémarre
    await Notifications.cancelAllScheduledNotificationsAsync();

    // C. Programmation de la notification de 9h00
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "☁️ Le nuage du jour est disponible ☁️",
        body: "Viens dessiner ce que tu vois !",
        sound: true,
      },
      trigger: {
        hour: 9,
        minute: 0,
        repeats: true, // Répéter chaque jour
      },
    });
    
    console.log("Notification programmée pour 9h00.");
  };
}