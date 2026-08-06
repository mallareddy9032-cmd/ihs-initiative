// ============================================================================
// FILE: src/types/navigation.ts
// CONTEXT: Shared root stack params for native + web shells
// ============================================================================

export type AmbulanceTrackingParams = {
  ihsUid: string;
  patientLat: number;
  patientLng: number;
  dispatchStatus: string;
};

export type RootStackParamList = {
  Login: { setAuth: (uid: string | null) => void };
  MainTabs: { ihsUid: string };
  Settings: undefined;
  AmbulanceTracking: AmbulanceTrackingParams;
};
