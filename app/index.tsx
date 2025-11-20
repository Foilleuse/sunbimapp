import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../src/lib/supabaseClient';
import { OTADebugPanel } from '../src/components/OTADebugPanel';
import { DrawingCanvas } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';

interface Cloud {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  published_for: string;
}

export default function DrawPage() {
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    fetchTodaysCloud();
  }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Supabase client check:', supabase ? 'OK' : 'NULL');
      console.log('🔍 Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING');
      console.log('🔍 Supabase Key:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'OK' : 'MISSING');

      if (!supabase) {
        throw new Error('Supabase client is not initialized. Check environment variables.');
      }

      const today = new Date().toISOString().split('T')[0];

      console.log('🔍 Fetching cloud for:', today);

      const { data, error: fetchError } = await supabase
        .from('clouds')
        .select('*')
        .eq('published_for', today)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Supabase error:', fetchError);
        throw fetchError;
      }

      console.log('✅ Cloud data:', data ? 'Found' : 'None for today');
      setCloud(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cloud';
      console.error('❌ Error loading cloud:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <OTADebugPanel />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#87CEEB" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <OTADebugPanel />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  if (!cloud) {
    return (
      <View style={styles.container}>
        <OTADebugPanel />
        <View style={styles.centerContent}>
          <Text style={styles.noCloudText}>No cloud published for today</Text>
        </View>
      </View>
    );
  }

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
  };

  const toggleDrawing = () => {
    setIsDrawingEnabled((prev) => !prev);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <OTADebugPanel />
        <View style={styles.header}>
          <Text style={styles.headerText}>sunbim</Text>
        </View>
        <Image
          source={{ uri: cloud.image_url }}
          style={styles.cloudImage}
          resizeMode="cover"
        />
        <DrawingCanvas
          ref={canvasRef}
          isDrawingEnabled={isDrawingEnabled}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          onClear={handleClear}
        />
        <DrawingControls
          isDrawingEnabled={isDrawingEnabled}
          onToggleDrawing={toggleDrawing}
          onClear={handleClear}
          strokeColor={strokeColor}
          onColorChange={setStrokeColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#000000',
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
});
