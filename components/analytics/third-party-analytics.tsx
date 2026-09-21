"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

import styles from "./third-party-analytics.module.css";

const consentStorageKey = "janvier-third-party-analytics-consent-v1";

type Consent = "accepted" | "loading" | "pending" | "rejected";

const consentChangeEvent = "janvier:analytics-consent-change";

function readConsent(): Consent {
  const stored = window.localStorage.getItem(consentStorageKey);
  return stored === "accepted" || stored === "rejected" ? stored : "pending";
}

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(consentChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(consentChangeEvent, onStoreChange);
  };
}

function validGoogleId(value: string | undefined, pattern: RegExp) {
  const normalized = value?.trim().toUpperCase();
  return normalized && pattern.test(normalized) ? normalized : null;
}

export function ThirdPartyAnalytics({
  googleAnalyticsId,
  googleTagManagerId
}: {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
}) {
  const analyticsId = validGoogleId(googleAnalyticsId, /^G-[A-Z0-9]+$/);
  const tagManagerId = validGoogleId(googleTagManagerId, /^GTM-[A-Z0-9]+$/);
  const consent = useSyncExternalStore(subscribeToConsent, readConsent, () => "loading");

  if (!analyticsId && !tagManagerId) return null;

  function choose(next: "accepted" | "rejected") {
    window.localStorage.setItem(consentStorageKey, next);
    window.dispatchEvent(new Event(consentChangeEvent));
  }

  return (
    <>
      {consent === "accepted" ? (
        tagManagerId ? (
          <>
            <Script id="janvier-gtm-data-layer" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});`}
            </Script>
            <Script
              src={`https://www.googletagmanager.com/gtm.js?id=${tagManagerId}`}
              strategy="afterInteractive"
            />
          </>
        ) : (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="janvier-ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analyticsId}',{anonymize_ip:true});`}
            </Script>
          </>
        )
      ) : null}

      {consent === "pending" ? (
        <section
          aria-label="Preferencias de medición"
          className={styles.notice}
          role="region"
        >
          <div>
            <strong>¿Nos permites medir cómo se usa el sitio?</strong>
            <p>
              La medición opcional nos ayuda a detectar páginas útiles y errores. Puedes
              rechazarla; el sitio seguirá funcionando igual.
            </p>
          </div>
          <div className={styles.actions}>
            <button onClick={() => choose("accepted")} type="button">
              Permitir medición
            </button>
            <button onClick={() => choose("rejected")} type="button">
              Continuar sin medir
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
