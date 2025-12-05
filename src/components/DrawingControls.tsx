import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Eraser, Undo2, Redo2, Share2 } from 'lucide-react-native';

interface DrawingControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  strokeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  isEraserMode: boolean;
  toggleEraser: () => void;
  onShare: () => void; // <--- Vérifie que ceci est bien là
  onClear?: () => void;
}

const COLORS = ['#FFFFFF', '#808080', '#000000'];

export const DrawingControls: React.FC<DrawingControlsProps> = ({
  onUndo, onRedo,
  strokeColor, onColorChange,
  strokeWidth, onStrokeWidthChange,
  isEraserMode, toggleEraser,
  onShare // <--- Et que ceci est bien récupéré ici
}) => {
  
  const [showColorMenu, setShowColorMenu] = useState(false);

  // MODIFICATION ICI : Épaisseur max réduite à 20
  const handleSliderTouch = (evt: any) => {
    const { locationX } = evt.nativeEvent;
    const width = 100; 
    const newSize = Math.max(2, Math.min(20, (locationX / width) * 20));
    onStrokeWidthChange(newSize);
  };

  return (
    <View style={styles.container}>
      
      {/* MENU COULEUR */}
      {showColorMenu && (
        <View style={styles.colorMenu}>
            {COLORS.map(c => (
                <TouchableOpacity 
                    key={c} 
                    onPress={() => { 
                        onColorChange(c); 
                        if (isEraserMode) toggleEraser();
                        setShowColorMenu(false); 
                    }}
                    style={[styles.colorOption, { backgroundColor: c }]}
                />
            ))}
            <View style={styles.menuArrow} />
        </View>
      )}

      {/* BARRE D'OUTILS */}
      <View style={styles.toolbar}>
        
        {/* GAUCHE : Undo / Redo */}
        <View style={styles.group}>
            <TouchableOpacity onPress={onUndo} style={styles.iconBtn} hitSlop={10}>
                <Undo2 color="#000" size={22} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRedo} style={styles.iconBtn} hitSlop={10}>
                <Redo2 color="#000" size={22} />
            </TouchableOpacity>
        </View>

        <View style={styles.separator} />

        {/* CENTRE : Gomme & Couleur */}
        <View style={styles.group}>
            <TouchableOpacity 
                onPress={toggleEraser} 
                style={[styles.toolBtn, isEraserMode && styles.activeTool]}
            >
                <Eraser color={isEraserMode ? "#FFF" : "#000"} size={20} />
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => setShowColorMenu(!showColorMenu)}
                style={[styles.colorTrigger, { backgroundColor: strokeColor }, isEraserMode && styles.inactiveColor]}
            />
        </View>

        <View style={styles.separator} />

        {/* DROITE : Slider & Share */}
        <View style={styles.group}>
            <View 
                style={styles.sliderContainer}
                onTouchStart={handleSliderTouch}
                onTouchMove={handleSliderTouch}
            >
                <View style={styles.sliderTrack}>
                    <View style={[styles.trackLine, { height: 1 }]} />
                </View>
                <View 
                    style={[
                        styles.sliderCursor, 
                        { 
                            width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth,
                            backgroundColor: isEraserMode ? '#000' : strokeColor,
                            // MODIFICATION ICI : Ajustement du calcul pour le max 20
                            left: `${(strokeWidth / 20) * 80}%`
                        }
                    ]} 
                />
            </View>

            {/* C'EST ICI LE PROBLÈME POTENTIEL */}
            <TouchableOpacity 
                onPress={onShare}  // <--- Vérifie que onPress appelle bien onShare
                style={styles.iconBtn}
                hitSlop={10} // Zone de clic agrandie
            >
                <Share2 color="#000" size={22} />
            </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center',
  },
  toolbar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    paddingVertical: 20, paddingBottom: 35, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'space-between', width: '100%',
    borderTopWidth: 1, borderColor: '#EEE',
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  separator: { width: 1, height: 20, backgroundColor: '#EEE', marginHorizontal: 5 },
  iconBtn: { padding: 4 },
  toolBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  activeTool: { backgroundColor: '#000' },
  colorTrigger: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#DDD' },
  inactiveColor: { opacity: 0.3 },
  colorMenu: {
    position: 'absolute', bottom: 90, backgroundColor: '#FFF', padding: 10, borderRadius: 15,
    flexDirection: 'row', gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 5, elevation: 6, zIndex: 999,
  },
  colorOption: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  menuArrow: {
    position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
    borderStyle: 'solid', backgroundColor: 'transparent',
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFF',
  },
  sliderContainer: { width: 80, height: 40, justifyContent: 'center' },
  sliderTrack: { width: '100%', height: 20, justifyContent: 'center' },
  trackLine: { backgroundColor: '#DDD', width: '100%' },
  sliderCursor: { position: 'absolute', borderWidth: 1, borderColor: '#CCC' }
});