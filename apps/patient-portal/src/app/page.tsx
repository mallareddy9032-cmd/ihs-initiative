import { AppShell } from '@/components/AppShell';
import { VaultTriageStudio } from '@/components/VaultTriageStudio';

export default function PatientPortalHomePage() {
  return (
    <AppShell title="Patient Portal" subtitle="Self-Service · Encrypted Health Vault">
      <VaultTriageStudio />
    </AppShell>
  );
}
