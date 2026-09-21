"use client";

const consentStorageKey = "janvier-third-party-analytics-consent-v1";

export function AnalyticsPreferencesButton({ className }: { className?: string }) {
  return (
    <button
      className={className}
      onClick={() => {
        window.localStorage.removeItem(consentStorageKey);
        window.location.reload();
      }}
      type="button"
    >
      Preferencias de medición
    </button>
  );
}
