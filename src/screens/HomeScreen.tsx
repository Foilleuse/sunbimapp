import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DrawingCanvas from '../components/DrawingCanvas';
import { colors, DrawingColor } from '../theme/colors';
import { Eraser, Trash2, Save } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.6;

const HomeScreen = () => {
  const [selectedColor, setSelectedColor] = useState<DrawingColor>('black');
  const [isEraser, setIsEraser] = useState(false);
  const canvasRef = useRef<any>(null);

  const drawingColors: DrawingColor[] = ['black', 'red', 'blue', 'green'];

  const handleClear = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Voulez-vous vraiment effacer votre dessin ?');
      if (confirmed && canvasRef.current) {
        canvasRef.current.clear();
      }
    } else {
      Alert.alert(
        'Effacer le dessin',
        'Voulez-vous vraiment effacer votre dessin ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Effacer',
            style: 'destructive',
            onPress: () => {
              if (canvasRef.current) {
                canvasRef.current.clear();
              }
            },
          },
        ]
      );
    }
  };

  const handleSave = async () => {
    try {
      const timestamp = new Date().toISOString();
      const drawingData = {
        timestamp,
        paths: canvasRef.current?.getPaths() || [],
      };

      await AsyncStorage.setItem(`drawing_${timestamp}`, JSON.stringify(drawingData));

      if (Platform.OS === 'web') {
        alert('Dessin sauvegardé localement !');
      } else {
        Alert.alert('Succès', 'Votre dessin a été sauvegardé localement !');
      }
    } catch (error) {
      console.error('Error saving drawing:', error);
      if (Platform.OS === 'web') {
        alert('Erreur lors de la sauvegarde');
      } else {
        Alert.alert('Erreur', 'Impossible de sauvegarder le dessin');
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>Sunbim</Text>
        <Text style={styles.subtitle}>Le nuage du jour</Text>
      </View>

      <View style={styles.canvasContainer}>
        <Image
          source={require('../../assets/cloud-placeholder.jpg')}
          style={styles.cloudImage}
          resizeMode="cover"
        />
        <DrawingCanvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          currentColor={selectedColor}
          isEraser={isEraser}
        />
      </View>

      <View style={styles.toolsContainer}>
        <View style={styles.colorPalette}>
          {drawingColors.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorButton,
                { backgroundColor: colors.drawing[color] },
                selectedColor === color && !isEraser && styles.selectedColor,
              ]}
              onPress={() => {
                setSelectedColor(color);
                setIsEraser(false);
              }}
            />
          ))}

          <TouchableOpacity
            style={[styles.toolButton, isEraser && styles.selectedTool]}
            onPress={() => setIsEraser(!isEraser)}
          >
            <Eraser size={24} color={isEraser ? colors.white : colors.black} />
          </TouchableOpacity>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleClear}>
            <Trash2 size={24} color={colors.white} />
            <Text style={styles.actionButtonText}>Effacer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
          >
            <Save size={24} color={colors.white} />
            <Text style={styles.actionButtonText}>Sauvegarder</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray.light,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.secondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray.medium,
    textAlign: 'center',
    marginTop: 4,
  },
  canvasContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: 'relative',
    backgroundColor: colors.white,
  },
  cloudImage: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  toolsContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 15,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.gray.light,
  },
  selectedColor: {
    borderWidth: 4,
    borderColor: colors.secondary,
    transform: [{ scale: 1.1 }],
  },
  toolButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.gray.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray.light,
  },
  selectedTool: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 15,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ui.error,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: colors.ui.success,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
