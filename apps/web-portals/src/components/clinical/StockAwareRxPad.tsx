// ============================================================================
// FILE: src/components/clinical/StockAwareRxPad.tsx
// CONTEXT: Physician Console - FEFO Inventory & WORM Authorization
// ============================================================================

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AuthApi, DrugItem, InventoryApi } from '@/services/api';

export const StockAwareRxPad: React.FC<{ caseId: string; fleetId: string }> = ({
  caseId,
  fleetId,
}) => {
  const [activeInventory, setActiveInventory] = useState<DrugItem[]>([]);
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [pin, setPin] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [signatureHash, setSignatureHash] = useState<string | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [reserveWarning, setReserveWarning] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    setInventoryError(null);
    try {
      const stock = await InventoryApi.getVehicleStock(fleetId);
      setActiveInventory(stock);
    } catch (err) {
      setInventoryError(
        err instanceof Error ? err.message : 'Failed to load fleet inventory.'
      );
      setActiveInventory([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, [fleetId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const drugLabel = (id: string) => {
    const match = activeInventory.find((drug) => drug.item_id === id);
    return match ? `${match.name} (${match.item_id})` : id;
  };

  const handleSelectDrug = async (drugId: string) => {
    if (!drugId || isLocked || selectedDrugs.includes(drugId)) return;

    setReserveWarning(null);
    const reserved = await InventoryApi.preReserveStock(drugId, caseId);
    if (!reserved) {
      setReserveWarning('Conflict: Drug just reserved by another active case.');
      return;
    }

    setSelectedDrugs((prev) => [...prev, drugId]);
  };

  const handleAuthorize = async () => {
    if (pin.length !== 6 || selectedDrugs.length === 0 || isLocked) return;

    setIsAuthorizing(true);
    setAuthError(null);

    try {
      const response = await AuthApi.generateESignature({
        case_id: caseId,
        prescribed_drugs: selectedDrugs,
        doctor_pin: pin,
      });

      setSignatureHash(response.sha256_signature);
      setIsLocked(true); // Hard lock the UI — WORM parity
      setPin('');
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'AUTHORIZATION FAILED: Invalid PIN or case state.'
      );
      setPin('');
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] text-[#1C1C1E]">
      <h3 className="text-lg font-bold border-b border-black/5 pb-2 mb-4 text-[#5856D6]">
        E-Prescription & Authorization
      </h3>

      {isLoadingInventory && (
        <div className="mb-4 text-sm text-gray-600 font-mono">Loading fleet inventory…</div>
      )}

      {inventoryError && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700"
        >
          {inventoryError}
          <button
            type="button"
            className="ml-3 underline font-bold"
            onClick={() => void loadInventory()}
          >
            Retry
          </button>
        </div>
      )}

      {reserveWarning && (
        <div role="alert" className="mb-4 rounded border border-yellow-500 bg-yellow-50 p-3 text-sm">
          {reserveWarning}
        </div>
      )}

      {/* INVENTORY SELECTOR */}
      <select
        className="w-full p-2 mb-4 border rounded disabled:bg-gray-200 disabled:text-gray-500"
        disabled={isLocked || isLoadingInventory || !!inventoryError}
        defaultValue=""
        onChange={(e) => {
          void handleSelectDrug(e.target.value);
          e.target.value = '';
        }}
      >
        <option value="">Select from Fleet Inventory...</option>
        {activeInventory.map((drug) => (
          <option key={drug.item_id} value={drug.item_id}>
            {drug.name} (Available: {drug.current_stock}) - Exp: {drug.expiry_date}
          </option>
        ))}
      </select>

      {!isLoadingInventory && !inventoryError && activeInventory.length === 0 && (
        <p className="mb-4 text-sm text-gray-500">No FEFO stock mapped to this vehicle.</p>
      )}

      {/* SELECTED ITEMS */}
      <ul className="mb-6 space-y-1">
        {selectedDrugs.map((id, idx) => (
          <li key={`${id}-${idx}`} className="text-sm">
            ✔️ {drugLabel(id)}
          </li>
        ))}
      </ul>

      {/* WORM COMPLIANCE AUTHORIZATION GATE */}
      <div
        className={`p-4 rounded border ${
          isLocked ? 'bg-green-100 border-green-500' : 'bg-white border-gray-300'
        }`}
      >
        {isLocked ? (
          <div>
            <div className="text-green-800 font-bold mb-1">🔐 AUTHORIZED & CLINICALLY LOCKED</div>
            <div className="font-mono text-xs text-gray-600 break-all">
              SHA-256: {signatureHash}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {authError && (
              <div role="alert" className="text-sm text-red-700 font-bold">
                {authError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                placeholder="Enter 6-Digit PIN"
                className="flex-grow p-2 border rounded text-center tracking-widest"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isAuthorizing}
              />
              <button
                type="button"
                className="bg-[#007AFF] text-white font-bold px-6 py-2 rounded-2xl hover:bg-[#0066d6] disabled:bg-[#F2F2F7] disabled:text-[#8E8E93] ios-press"
                onClick={() => void handleAuthorize()}
                disabled={isAuthorizing || pin.length !== 6 || selectedDrugs.length === 0}
              >
                {isAuthorizing ? 'SIGNING…' : 'APPLY E-SIGNATURE'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
