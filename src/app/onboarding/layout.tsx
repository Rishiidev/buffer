import type { Metadata } from "next";

// Onboarding is a private form for first-time users. Don't index it.
export const metadata: Metadata = {
  title: "Welcome — Buffer",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
