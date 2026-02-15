import { useCallback, useState } from 'react';

interface Coordinates {
  lat: number;
  lon: number;
}

export function useGeocoding() {
  const [isGeocoding, setIsGeocoding] = useState(false);

  const geocodeAddress = useCallback(async (address: string): Promise<Coordinates | null> => {
    if (!address.trim() || typeof kakao === 'undefined' || !kakao.maps?.services?.Geocoder) {
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result: kakao.maps.services.Geocoder.Result[], status: kakao.maps.services.Status) => {
        if (status === kakao.maps.services.Status.OK && result.length > 0) {
          const coords = result[0];
          resolve({ lat: parseFloat(coords.y), lon: parseFloat(coords.x) });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  const geocodeWithLoading = useCallback(async (address: string): Promise<Coordinates | null> => {
    setIsGeocoding(true);
    try {
      return await geocodeAddress(address);
    } finally {
      setIsGeocoding(false);
    }
  }, [geocodeAddress]);

  return {
    isGeocoding,
    geocodeAddress,
    geocodeWithLoading,
    setIsGeocoding,
  };
}
