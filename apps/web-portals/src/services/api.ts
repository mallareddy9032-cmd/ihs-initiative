// ============================================================================
// FILE: src/services/api.ts
// CONTEXT: Cloud Engine REST clients for portals
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

async function parseJsonSafe(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface DispatchResult {
  success: boolean;
  requiresCoPay?: boolean;
  fee?: number;
  message?: string;
  fleetId?: string;
}

export interface DrugItem {
  item_id: string;
  name: string;
  current_stock: number;
  expiry_date: string;
}

export interface ESignResponse {
  sha256_signature: string;
  clinical_release_authorized: boolean;
}

export interface AuthSuccess {
  success: boolean;
  operator: {
    uid: string;
    name: string;
    role: 'DISPATCHER' | 'PHYSICIAN' | 'SYSTEM_ADMIN';
  };
  message: string;
  token?: string;
}

export const AuthApi = {
  async login(uid: string, pin: string): Promise<AuthSuccess> {
    // Prefer same-origin Next route so the JWT cookie lands on the portals host
    const response = await fetch(`/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ uid, pin }),
    });

    const body = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(
        typeof body.error === 'string' ? body.error : 'Authentication failed. Verify credentials.'
      );
    }

    return body as unknown as AuthSuccess;
  },

  async logout(): Promise<void> {
    await fetch(`/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async generateESignature(input: {
    case_id: string;
    prescribed_drugs: string[];
    doctor_pin: string;
  }): Promise<ESignResponse> {
    const response = await fetch(`${API_BASE}/v1/auth/e-sign/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const body = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(
        typeof body.error === 'string'
          ? body.error
          : 'AUTHORIZATION FAILED: Invalid PIN or case state.'
      );
    }

    return body as unknown as ESignResponse;
  },
};

export const FsmEngineApi = {
  async attemptDispatch(
    ihsUid: string,
    isProxy: boolean,
    options?: {
      caseId?: string;
      patientInternalId?: string;
      overrideReason?: string;
      fleetId?: string;
    }
  ): Promise<DispatchResult> {
    const params = new URLSearchParams({
      ihs_uid: ihsUid,
      is_proxy: String(isProxy),
    });

    if (options?.caseId) params.set('case_id', options.caseId);
    if (options?.patientInternalId) params.set('patient_id', options.patientInternalId);
    if (options?.overrideReason) params.set('override_reason', options.overrideReason);
    if (options?.fleetId) params.set('fleet_id', options.fleetId);

    const response = await fetch(`${API_BASE}/v1/billing/mobilization-check?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    const body = await parseJsonSafe(response);

    if (response.status === 402) {
      return {
        success: false,
        requiresCoPay: true,
        fee: typeof body.fee_required === 'number' ? body.fee_required : 499,
        message:
          typeof body.message === 'string'
            ? body.message
            : 'Monthly doorstep quota exceeded. ₹499 co-pay required to dispatch.',
      };
    }

    if (!response.ok) {
      throw new Error(
        typeof body.error === 'string' ? body.error : 'Dispatch authorization failed.'
      );
    }

    // Prefer explicit FSM attempt when case identifiers are available
    if (options?.caseId || options?.patientInternalId) {
      const dispatchResponse = await fetch(`${API_BASE}/v1/fsm/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          case_id: options.caseId,
          patient_id: options.patientInternalId,
          ihs_uid: ihsUid,
          is_proxy: isProxy,
          override_reason: options.overrideReason,
          fleet_id: options.fleetId,
        }),
      });

      const dispatchBody = await parseJsonSafe(dispatchResponse);

      if (dispatchResponse.status === 402 || dispatchBody.requiresCoPay === true) {
        return {
          success: false,
          requiresCoPay: true,
          fee: typeof dispatchBody.fee === 'number' ? dispatchBody.fee : 499,
        };
      }

      if (!dispatchResponse.ok) {
        throw new Error(
          typeof dispatchBody.error === 'string'
            ? dispatchBody.error
            : 'Fleet mobilization failed.'
        );
      }

      return {
        success: true,
        requiresCoPay: false,
        fee: 0,
        message:
          typeof dispatchBody.message === 'string'
            ? dispatchBody.message
            : 'DISPATCH AUTHORIZED',
        fleetId:
          typeof dispatchBody.fleet_id === 'string'
            ? dispatchBody.fleet_id
            : options.fleetId,
      };
    }

    return {
      success: true,
      requiresCoPay: false,
      fee: typeof body.fee_required === 'number' ? body.fee_required : 0,
      message: typeof body.status === 'string' ? body.status : 'APPROVED',
      fleetId: options?.fleetId,
    };
  },
};

export const InventoryApi = {
  async getVehicleStock(fleetId: string): Promise<DrugItem[]> {
    const response = await fetch(
      `${API_BASE}/v1/inventory/vehicle/${encodeURIComponent(fleetId)}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    const body = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(
        typeof body.error === 'string' ? body.error : 'Failed to load fleet inventory.'
      );
    }

    if (Array.isArray(body)) {
      return body as unknown as DrugItem[];
    }

    if (Array.isArray(body.items)) {
      return body.items as DrugItem[];
    }

    return [];
  },

  async preReserveStock(drugId: string, caseId: string): Promise<boolean> {
    const response = await fetch(`${API_BASE}/v1/inventory/pre-reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ drug_id: drugId, case_id: caseId }),
    });

    return response.ok;
  },
};

/** MLC / Safe Harbor — statutory 108/112 (never waits on fleet engine). */
export const MlcApi = {
  async screeningRedirect(input: {
    caseId?: string;
    ihsUid?: string;
    patientName?: string;
    chiefComplaint?: string;
    liveGps?: { lat: number; lng: number };
    createCase?: boolean;
  }): Promise<{
    success: boolean;
    case_id?: string;
    statutory?: { primary: string; secondary: string };
    dial_hints?: string[];
    script?: string;
    message?: string;
  }> {
    const response = await fetch(`${API_BASE}/v1/fsm/mlc-screening`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        case_id: input.caseId,
        ihs_uid: input.ihsUid,
        patient_name: input.patientName,
        chief_complaint: input.chiefComplaint,
        live_gps: input.liveGps,
        create_case: input.createCase ?? true,
      }),
    });
    const body = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(typeof body.error === 'string' ? body.error : 'MLC screening failed');
    }
    return body as {
      success: boolean;
      case_id?: string;
      statutory?: { primary: string; secondary: string };
      dial_hints?: string[];
      script?: string;
      message?: string;
    };
  },

  async triggerSafeHarbor(caseId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${API_BASE}/v1/fsm/safe-harbor-mlc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ case_id: caseId }),
    });
    const body = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(typeof body.error === 'string' ? body.error : 'Safe Harbor failed');
    }
    return body;
  },
};
