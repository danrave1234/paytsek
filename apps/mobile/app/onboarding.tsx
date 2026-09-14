import { Redirect } from 'expo-router';

/** Compatibility route for old navigation state; the onboarding page is gone. */
export default function RemovedOnboarding() {
  return <Redirect href="/(tabs)" />;
}
