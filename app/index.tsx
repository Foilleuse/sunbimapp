import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { Pencil, Eraser, Palette, Sliders } from 'lucide-react-native';

interface Cloud {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  published_for: string;
}

interface DrawingPath {
  path: any;
  color: string;
  strokeWidth: number;
}

export default function DrawPage() {
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [paths, setPaths] = useState<DrawingPath[]>([]);

  const colors = ['#000000', '#FF0000', '#0000FF'];
  const strokeWidths = [2, 3, 5, 8, 12];

  useEffect(() => {
    fetchTodaysCloud();
  }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('clouds')
        .select('*')
        .eq('published_for', today)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      setCloud(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cloud');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPaths([]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#87CEEB" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (!cloud) {
    return (
      <View style={styles.container}>
        <Text style={styles.noCloudText}>No cloud published for today</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>sunbim</Text>
      </View>

      <Image
        source={{ uri: cloud.image_url }}
        style={styles.cloudImage}
        resizeMode="cover"
      />

      <DrawingCanvas
        enabled={drawingEnabled}
        color={selectedColor}
        strokeWidth={strokeWidth}
        onClear={handleClear}
      />

      <View style={styles.toolbarContainer}>
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.toolButton, drawingEnabled && styles.toolButtonActive]}
            onPress={() => setDrawingEnabled(!drawingEnabled)}
          >
            <Pencil color={drawingEnabled ? '#FF0000' : '#fff'} size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={handleClear}
          >
            <Eraser color="#fff" size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, showColorPicker && styles.toolButtonActive]}
            onPress={() => {
              setShowColorPicker(!showColorPicker);
              setShowStrokePicker(false);
            }}
          >
            <Palette color={showColorPicker ? '#FF0000' : '#fff'} size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, showStrokePicker && styles.toolButtonActive]}
            onPress={() => {
              setShowStrokePicker(!showStrokePicker);
              setShowColorPicker(false);
            }}
          >
            <Sliders color={showStrokePicker ? '#FF0000' : '#fff'} size={24} />
          </TouchableOpacity>
        </View>

        {showColorPicker && (
          <View style={styles.pickerContainer}>
            {colors.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorButtonSelected,
                ]}
                onPress={() => {
                  setSelectedColor(color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </View>
        )}

        {showStrokePicker && (
          <View style={styles.pickerContainer}>
            {strokeWidths.map((width) => (
              <TouchableOpacity
                key={width}
                style={[
                  styles.strokeButton,
                  strokeWidth === width && styles.strokeButtonSelected,
                ]}
                onPress={() => {
                  setStrokeWidth(width);
                  setShowStrokePicker(false);
                }}
              >
                <View
                  style={{
                    width: width * 2,
                    height: width * 2,
                    borderRadius: width,
                    backgroundColor: '#fff',
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF0000',
  },
  cloudImage: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  noCloudText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  toolbarContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  toolButton: {
    padding: 10,
    borderRadius: 20,
  },
  toolButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 15,
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
  strokeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  strokeButtonSelected: {
    borderColor: '#fff',
    borderWidth: 2,
  },
});
