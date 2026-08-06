/**
 * Browser Geolocation shim for @react-native-community/geolocation
 */

type SuccessCallback = (position: {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}) => void;

type ErrorCallback = (error: { code: number; message: string; PERMISSION_DENIED: number }) => void;

type Options = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
};

const Geolocation = {
  getCurrentPosition(
    success: SuccessCallback,
    error?: ErrorCallback,
    options?: Options,
  ): void {
    if (!navigator.geolocation) {
      error?.({
        code: 2,
        message: 'Geolocation is not available in this browser.',
        PERMISSION_DENIED: 1,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        success({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        });
      },
      (err) => {
        error?.({
          code: err.code,
          message: err.message,
          PERMISSION_DENIED: 1,
        });
      },
      options,
    );
  },

  watchPosition(
    success: SuccessCallback,
    error?: ErrorCallback,
    options?: Options,
  ): number {
    if (!navigator.geolocation) {
      error?.({
        code: 2,
        message: 'Geolocation is not available in this browser.',
        PERMISSION_DENIED: 1,
      });
      return -1;
    }
    return navigator.geolocation.watchPosition(
      (position) => {
        success({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        });
      },
      (err) => {
        error?.({
          code: err.code,
          message: err.message,
          PERMISSION_DENIED: 1,
        });
      },
      options,
    );
  },

  clearWatch(watchId: number): void {
    if (watchId >= 0) {
      navigator.geolocation.clearWatch(watchId);
    }
  },

  setRNConfiguration(): void {
    // no-op on web
  },

  requestAuthorization(): void {
    // Browser prompts on first getCurrentPosition
  },
};

export default Geolocation;
