import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates'; // <--- AJOUTÉ

interface Cloud {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  published_for: string;
}

export default function DrawPage() {
  const router = useRouter(); 
  
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  const canvasRef = useRef<DrawingCanvasRef>(null);

  // Récupération de l'ID de mise à jour (ou 'DEV' si local)
  const updateLabel = Updates.updateId ? `v.${Updates.updateId.substring(0, 6)}` : 'Dev Mode';

  useEffect(() => {
    fetchTodaysCloud();
  }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!supabase) throw new Error('Supabase client is not initialized.');

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error: fetchError } = await supabase
        .from('clouds')
        .select('*')
        .eq('published_for', today)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setCloud(data);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cloud';
      console.error('❌ Error loading cloud:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

 const handleShare = async () => {
    if (!canvasRef.current) return;
    
    try {
        const pathsData = canvasRef.current.getPaths();
        
        // --- DEBUG ---
        if (pathsData.length > 0) {
             console.log("🛑 ANALYSE DU DESSIN :");
             const firstPath = pathsData[0].svgPath;
             console.log("1. Exemple de trait (SVG):", firstPath.substring(0, 100) + "...");
             // Si les chiffres dans le SVG sont petits (ex: "M 20 50"), c'est un problème d'échelle.
             // Sur une photo, on attend des chiffres comme "M 500 1200".
        }
        // -------------
        
        if (!pathsData || pathsData.length === 0) {
            Alert.alert("Oups", "Dessine quelque chose avant de partager !");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        const { error: dbError } = await supabase
            .from('drawings')
            .insert({
                cloud_id: cloud?.id,
                user_id: user?.id, 
                canvas_data: pathsData,
                cloud_image_url: cloud?.image_url,
                is_shared: true
            });

        if (dbError) throw dbError;

        Alert.alert("Succès !", "Sauvegardé avec succès");
        router.push('/feed');
        
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#87CEEB" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  if (!cloud) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.noCloudText}>No cloud published for today</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Header Fixe */}
      <View style={styles.header}>
        <Text style={styles.headerText}>sunbim</Text>
        {/* PETIT TEXTE DE DEBUG */}
        <Text style={styles.versionText}>{updateLabel}</Text>
      </View>

      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          imageUri={cloud.image_url}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          isEraserMode={isEraserMode}
          onClear={handleClear}
        />
      </View>
      
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={{flex: 1}} pointerEvents="none" /> 
        <DrawingControls
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            strokeColor={strokeColor}
            onColorChange={setStrokeColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            isEraserMode={isEraserMode}
            toggleEraser={toggleEraser}
            onShare={handleShare}
         />
      </View>
    </View>
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
  canvasContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000', 
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  headerText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  // Style pour le petit texte discret
  versionText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)', // Semi-transparent
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
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