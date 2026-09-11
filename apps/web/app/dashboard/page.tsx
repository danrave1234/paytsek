import type { Metadata } from 'next';
import { DashboardClient } from '@/components/dashboard-client';

export const metadata: Metadata = {
  title: 'Workspace dashboard',
  description: 'Payment records, collectors, team members and billing for your PayTsek workspace.',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
