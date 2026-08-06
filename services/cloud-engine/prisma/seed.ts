// ============================================================================
// FILE: prisma/seed.ts
// CONTEXT: Seed Patient Ramu, Dr. Ananya Rao, AMB-VSKP-07 into SQLite
// ============================================================================

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pin = await bcrypt.hash('123456', 10);

  const ramuId = '11111111-1111-4111-8111-111111111001';
  const ramu = await prisma.patient.upsert({
    where: { ihsUid: 'IHS-ADMIN-00001' },
    create: {
      id: ramuId,
      ihsUid: 'IHS-ADMIN-00001',
      name: 'Ramu SuperAdmin',
      firstName: 'Ramu',
      lastName: 'SuperAdmin',
      phone: '+919876543210',
      emergencyContact: '+919000000001',
      capitationStatus: 'ACTIVE',
      homeLat: 17.7231,
      homeLng: 83.3012,
    },
    update: {
      name: 'Ramu SuperAdmin',
      phone: '+919876543210',
      capitationStatus: 'ACTIVE',
    },
  });

  await prisma.operator.upsert({
    where: { ihsUid: 'DOC-101' },
    create: {
      id: '22222222-2222-4222-8222-222222222101',
      ihsUid: 'DOC-101',
      fullName: 'Dr. Ananya Rao',
      hashedPin: pin,
      role: 'PHYSICIAN',
      status: 'ACTIVE',
    },
    update: {
      fullName: 'Dr. Ananya Rao',
      hashedPin: pin,
      role: 'PHYSICIAN',
      status: 'ACTIVE',
    },
  });

  await prisma.operator.upsert({
    where: { ihsUid: 'DSP-0442' },
    create: {
      id: '22222222-2222-4222-8222-222222222001',
      ihsUid: 'DSP-0442',
      fullName: 'Ramu Dispatcher',
      hashedPin: pin,
      role: 'DISPATCHER',
      status: 'ACTIVE',
    },
    update: { hashedPin: pin, status: 'ACTIVE' },
  });

  await prisma.fleetUnit.upsert({
    where: { vehicleNumber: 'AMB-VSKP-07' },
    create: {
      vehicleNumber: 'AMB-VSKP-07',
      driverName: 'Ravi Kumar',
      status: 'AVAILABLE',
      fuelLevel: 82,
      standbyPhone: '+919876500007',
    },
    update: {
      driverName: 'Ravi Kumar',
      status: 'AVAILABLE',
      fuelLevel: 82,
    },
  });

  for (const bay of ['BAY-1', 'BAY-2', 'BAY-3', 'BAY-4']) {
    await prisma.traumaBay.upsert({
      where: { bayName: bay },
      create: { bayName: bay, isOccupied: false },
      update: {},
    });
  }

  const sub = await prisma.subscription.findFirst({ where: { patientId: ramu.id } });
  if (!sub) {
    await prisma.subscription.create({
      data: { patientId: ramu.id, status: 'ACTIVE', doorstepVisitsRemaining: 3 },
    });
  }

  console.log('[seed] OK — Ramu SuperAdmin, Dr. Ananya Rao (DOC-101), AMB-VSKP-07');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
