import { useState, useEffect } from 'react';
import { Camera } from 'expo-camera';

export const useCameraPermission = () => {
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const ensurePermission = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      return result.granted;
    }
    return true;
  };

  return {
    hasPermission: permission?.granted ?? false,
    isLoading: !isReady || permission === null,
    requestPermission: ensurePermission,
  };
};
