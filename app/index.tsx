import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';
import { SunbimHeader } from '../src/components/SunbimHeader'; // <--- LE HEADER PROFIL
import { useRouter } from 'expo-router';

interface Cloud {
  id: string;
  image_url: string;
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

  useEffect(() => { fetchTodaysCloud(); }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) throw new Error('Supabase not init');
      const today = new Date().toISOString().split('T')[0];
      const { data, error: fetchError } = await supabase
        .from('clouds').select('*').eq('published_for', today).maybeSingle();
      if (fetchError) throw fetchError;
      setCloud(data);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  const handleShare = async () => {
    if (!canvasRef.current) return;
    try {
        const pathsData = canvasRef.current.getPaths();
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

        Alert.alert("Succès !", "Ton œuvre est sauvegardée dans le cloud ☁️");
        
        // REDIRECTION VERS LES TABS (C'est la seule porte d'entrée)
        router.replace('/(tabs)/feed'); 
        
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#87CEEB" style={{marginTop:100}} /></View>;
  if (error) return <View style={styles.container}><ActivityIndicator color="red" /></View>; // Simplifié pour le layout

  return (
    <View style={styles.container}>
      
      {/* HEADER AVEC BOUTON PROFIL */}
      {/* showCloseButton={false} car on est à la racine */}
      {/* showProfileButton={true} car c'est le SEUL endroit pour se connecter */}
      <SunbimHeader showCloseButton={false} showProfileButton={true} />

      <View style={styles.canvasContainer}>
        {/* Le header prend de la place maintenant, on décale un peu si besoin ou on laisse le flux normal */}
        <DrawingCanvas
          ref={canvasRef}
          imageUri={cloud?.image_url || ""}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          isEraserMode={isEraserMode}
          onClear={handleClear}
        />
      </View>
      
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={{flex: 1}} pointerEvents="none" /> 
        <DrawingControls
            onUndo={handleUndo} onRedo={handleRedo} onClear={handleClear}
            strokeColor={strokeColor} onColorChange={setStrokeColor}
            strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
            isEraserMode={isEraserMode} toggleEraser={toggleEraser}
            onShare={handleShare}
         />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  // Note: Le SunbimHeader a son propre style (fond blanc), ici il sera en haut
  // Comme le canvasContainer est flex:1, il prendra la place restante en dessous.
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center', marginTop: 100 },
});