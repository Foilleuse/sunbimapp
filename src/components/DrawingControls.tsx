import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pencil, Eraser, Move } from 'lucide-react-native';

interface DrawingControlsProps {
  isDrawingEnabled: boolean;
  onToggleDrawing: () => void;
  onClear: () => void;
  strokeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
}

const COLORS = [
  { name: 'Noir', value: '#000000' },
  { name: 'Rouge', value: '#FF0000' },
  { name: 'Bleu', value: '#0000FF' },
];

export const DrawingControls: React.FC<DrawingControlsProps> = ({
  isDrawingEnabled,
  onToggleDrawing,
  onClear,
  strokeColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topControls}>
        <TouchableOpacity
          style={[styles.button, isDrawingEnabled && styles.buttonActive]}
          onPress={onToggleDrawing}
        >
          {isDrawingEnabled ? (
            <Pencil color="#fff" size={24} />
          ) : (
            <Move color="#fff" size={24} />
          )}
          <Text style={styles.buttonText}>
            {isDrawingEnabled ? 'Dessin' : 'Déplacer'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <Eraser color="#fff" size={24} />
          <Text style={styles.buttonText}>Effacer</Text>
        </TouchableOpacity>
      </View>

      {isDrawingEnabled && (
        <View style={styles.drawingOptions}>
          <View style={styles.colorPicker}>
            <Text style={styles.label}>Couleur:</Text>
            <View style={styles.colorButtons}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color.value },
                    strokeColor === color.value && styles.colorButtonSelected,
                  ]}
                  onPress={() => onColorChange(color.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.thicknessControl}>
            <Text style={styles.label}>Épaisseur:</Text>
            <View style={styles.thicknessButtons}>
              {[3, 6, 10, 15].map((width) => (
                <TouchableOpacity
                  key={width}
                  style={[
                    styles.thicknessButton,
                    strokeWidth === width && styles.thicknessButtonSelected,
                  ]}
                  onPress={() => onStrokeWidthChange(width)}
                >
                  <Text style={styles.thicknessButtonText}>{width}px</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
  },
  clearButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  drawingOptions: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 15,
  },
  colorPicker: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  colorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#fff',
    borderWidth: 3,
  },
  thicknessControl: {
    marginTop: 5,
  },
  thicknessButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  thicknessButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thicknessButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderColor: '#fff',
  },
  thicknessButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
