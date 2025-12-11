import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Eraser, Undo2, Redo2, Share2, User } from 'lucide-react-native';

interface DrawingControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  strokeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  isEraserMode: boolean;
  toggleEraser: () => void;
  onShare: () => void;
  onClear?: () => void;
  isAuthenticated: boolean;
}

const COLORS = ['#FFFFFF', '#808080', '#000000'];

export const DrawingControls: React.FC<DrawingControlsProps> = ({
  onUndo, onRedo,
  strokeColor, onColorChange,
  strokeWidth, onStrokeWidthChange,
  isEraserMode, toggleEraser,
  onShare,
  isAuthenticated
}) => {
  
  const [showColorMenu, setShowColorMenu] = useState(false);

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

        {/* DROITE : Slider & Share/User */}
        <View style={styles.group}>
            
            <View style={styles.sliderContainer}
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
                            left: `${(strokeWidth / 20) * 80}%`
                        }
                    ]} 
                />
            </View>

            <TouchableOpacity 
                onPress={onShare}
                style={styles.iconBtn}
                hitSlop={10}
            >
                {isAuthenticated ? (
                    <Share2 color="#000" size={22} />
                ) : (
                    <User color="#000" size={22} />
                )}
            </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center', 
  },
  toolbar: {
    flexDirection: 'row', 
    backgroundColor: 'rgba(255, 255, 255, 0.5)', 
    paddingVertical: 15, 
    paddingHorizontal: 20,
    alignItems: 'center', 
    justifyContent: 'space-between', 
    width: '100%',
    borderRadius: 30, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)', 
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 12 }, 
  separator: { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 5 },
  iconBtn: { padding: 4 },
  toolBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)' }, 
  activeTool: { backgroundColor: '#000' },
  colorTrigger: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  inactiveColor: { opacity: 0.3 },
  colorMenu: {
    position: 'absolute', bottom: 80, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 20,
    flexDirection: 'row', gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, zIndex: 999,
  },
  colorOption: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  menuArrow: {
    position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
    borderStyle: 'solid', backgroundColor: 'transparent',
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,255,255,0.9)',
  },
  sliderContainer: { width: 60, height: 40, justifyContent: 'center' }, 
  sliderTrack: { width: '100%', height: 20, justifyContent: 'center' },
  trackLine: { backgroundColor: 'rgba(0,0,0,0.1)', width: '100%' }, 
  sliderCursor: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' }
});