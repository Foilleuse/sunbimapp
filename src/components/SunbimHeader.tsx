import React from 'react';

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

import { X, Bell, User } from 'lucide-react-native'; 

import { useRouter } from 'expo-router';

import * as Updates from 'expo-updates';



interface SunbimHeaderProps {

  showCloseButton?: boolean;

  onClose?: () => void;

  showNotificationButton?: boolean; 

  showProfileButton?: boolean; 

  transparent?: boolean; 

}



export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ 

  showCloseButton, 

  onClose,

  showNotificationButton = false,

  showProfileButton = false,

  transparent = false 

}) => {

  const router = useRouter();



  // Récupération de l'ID de mise à jour (ou 'Dev' si en local)

  const updateLabel = Updates.updateId ? `v.${Updates.updateId.substring(0, 6)}` : 'Dev Mode';



  const handleClose = () => {

    if (onClose) onClose();

    else router.back();

  };



  const handleNotifications = () => {

      Alert.alert("Notifications", "Aucune nouvelle notification.");

  };



  const handleProfile = () => {

      router.push('/(tabs)/profile');

  };



  return (

    <View style={[

        styles.headerBar, 

        transparent && styles.transparentHeader 

    ]}>

      {/* Conteneur Titre + Version */}

      <View style={styles.titleContainer}>

          <Text style={[styles.headerText, transparent && styles.whiteText]}>nyola</Text>

          <Text style={[styles.versionText, transparent && styles.whiteSubText]}>{updateLabel}</Text>

      </View>

      

      {showCloseButton && (

        <TouchableOpacity style={styles.leftBtn} onPress={handleClose} hitSlop={10}>

           <X color={transparent ? "#FFF" : "#000"} size={28} />

        </TouchableOpacity>

      )}



      <View style={styles.rightBtn}>

          {showNotificationButton && (

              <TouchableOpacity onPress={handleNotifications} hitSlop={10}>

                  <Bell color={transparent ? "#FFF" : "#000"} size={26} />

              </TouchableOpacity>

          )}

          

          {showProfileButton && (

              <TouchableOpacity onPress={handleProfile} hitSlop={10}>

                  <User color={transparent ? "#FFF" : "#000"} size={26} />

              </TouchableOpacity>

          )}

      </View>

    </View>

  );

};



const styles = StyleSheet.create({

  headerBar: {

    width: '100%',

    backgroundColor: '#FFFFFF', 

    paddingTop: 60, 

    paddingBottom: 15,

    paddingHorizontal: 20,

    flexDirection: 'row',

    justifyContent: 'center', 

    alignItems: 'center',

    zIndex: 100, 

    borderBottomWidth: 1,

    borderBottomColor: '#ffffffff', 

  },

  transparentHeader: {

      backgroundColor: 'transparent',

      borderBottomWidth: 0,

      position: 'absolute', // Pour flotter au-dessus du contenu

      top: 0,

      left: 0,

      right: 0,

  },

  titleContainer: {

      alignItems: 'center',

  },

  headerText: {

    fontSize: 32,

    fontWeight: '900',

    color: '#ffffffff', 
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 }, 
    textShadowRadius: 0,
    lineHeight: 34,

  },

  whiteText: {

      color: '#FFFFFF', // Texte blanc sur fond transparent (supposé sur fond bleu)

  },

  versionText: {

      fontSize: 10,

      color: '#999', 

      marginTop: -2,

  },

  whiteSubText: {

      color: 'rgba(255,255,255,0.7)',

  },

  leftBtn: {

    position: 'absolute',

    left: 20,

    bottom: 20,

  },

  rightBtn: {

    position: 'absolute',

    right: 20,

    bottom: 20,

  },

});