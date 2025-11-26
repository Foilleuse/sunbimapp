const handleSend = async () => {
    if (!newComment.trim()) return;
    
    // Petite sécurité : si user est null, on ne peut pas poster
    if (!user) {
        alert("Tu dois être connecté pour commenter.");
        return;
    }

    setSending(true);
    try {
      console.log("Envoi du commentaire...", { user_id: user.id, drawing_id: drawingId });
      
      const { error } = await supabase
        .from('comments')
        .insert({ 
            user_id: user.id, 
            drawing_id: drawingId, 
            content: newComment.trim() 
        });
      
      if (error) {
          console.error("Erreur Supabase:", error);
          throw error;
      }

      // Succès
      setNewComment('');
      // On recharge la liste pour voir le nouveau com
      await fetchComments(); 
      
    } catch (e: any) {
      // Affiche l'erreur à l'écran pour qu'on sache ce qui se passe
      alert("Erreur envoi : " + e.message);
    } finally {
      setSending(false);
    }
  };