// ============================================================================
// FILE: src/communication/rest/AuthController.ts
// CONTEXT: Node.js Identity & Access Management (IAM)
// ============================================================================

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { ihsDbClient } from '../../infrastructure/database/client';
import { DemoStore, isDemoMode } from '../../infrastructure/demo/DemoStore';
import { JwtEngine } from '../../utils/jwt';

function setAuthCookie(res: Response, token: string) {
  res.cookie('ihs_auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export class AuthController {
  static async authenticateOperator(req: Request, res: Response) {
    try {
      const body = req.body as { uid?: string; ihs_uid?: string; pin?: string };
      // Portals send `ihs_uid`; legacy clients may still send `uid`.
      const uid = (body.ihs_uid || body.uid || '').trim().toUpperCase();
      const pin = typeof body.pin === 'string' ? body.pin : '';

      if (!uid || !pin) {
        return res.status(400).json({ error: 'MALFORMED_CREDENTIALS' });
      }

      if (isDemoMode()) {
        const operator = DemoStore.findOperatorByUid(uid);
        if (!operator || operator.status !== 'ACTIVE') {
          return res.status(401).json({ error: 'INVALID_CREDENTIALS_OR_INACTIVE' });
        }

        const isPinValid = await bcrypt.compare(pin, operator.hashed_pin);
        if (!isPinValid) {
          return res.status(401).json({ error: 'INVALID_CREDENTIALS_OR_INACTIVE' });
        }

        const token = JwtEngine.generateToken({
          internal_id: operator.operator_id,
          ihs_uid: operator.ihs_uid,
          role: operator.role,
        });

        setAuthCookie(res, token);

        return res.status(200).json({
          success: true,
          operator: {
            uid: operator.ihs_uid,
            name: operator.full_name,
            role: operator.role,
          },
          token, // also returned so Next.js can mirror the cookie on the portals origin
          message: 'AUTHENTICATION_SUCCESSFUL',
        });
      }

      const operator = await ihsDbClient.operator.findUnique({
        where: { ihsUid: uid },
      });

      if (!operator || operator.status !== 'ACTIVE') {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS_OR_INACTIVE' });
      }

      const isPinValid = await bcrypt.compare(pin, operator.hashedPin);
      if (!isPinValid) {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS_OR_INACTIVE' });
      }

      const token = JwtEngine.generateToken({
        internal_id: operator.id,
        ihs_uid: operator.ihsUid,
        role: operator.role as 'DISPATCHER' | 'PHYSICIAN' | 'SYSTEM_ADMIN',
      });

      setAuthCookie(res, token);

      return res.status(200).json({
        success: true,
        operator: {
          uid: operator.ihsUid,
          name: operator.fullName,
          role: operator.role,
        },
        token,
        message: 'AUTHENTICATION_SUCCESSFUL',
      });
    } catch (error) {
      console.error('Authentication Error:', error);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async destroySession(_req: Request, res: Response) {
    res.cookie('ihs_auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      expires: new Date(0),
      path: '/',
    });

    return res.status(200).json({ success: true, message: 'SESSION_DESTROYED' });
  }
}
