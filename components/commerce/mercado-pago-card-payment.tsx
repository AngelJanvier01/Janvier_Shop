"use client";

import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./mercado-pago-card-payment.module.css";

const initializedPublicKeys = new Set<string>();

type MercadoPagoCardPaymentProps = {
  amount: number;
  customerEmail: string;
  orderReference: string;
  publicKey: string;
};

export function MercadoPagoCardPayment({
  amount,
  customerEmail,
  orderReference,
  publicKey
}: MercadoPagoCardPaymentProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<"approved" | "pending" | null>(null);

  // The official SDK must be initialized before CardPayment mounts. The public key is safe to
  // expose and this bounded set avoids reinjecting its SDK on re-renders.
  if (!initializedPublicKeys.has(publicKey)) {
    initMercadoPago(publicKey, { locale: "es-MX" });
    initializedPublicKeys.add(publicKey);
  }

  if (result === "approved") {
    return (
      <div className={styles.result} data-status="approved">
        <strong>PAGO RECIBIDO Y VERIFICADO.</strong>
        <span>
          La actualización también queda protegida por las notificaciones oficiales.
        </span>
      </div>
    );
  }

  return (
    <div className={styles.checkout}>
      {result === "pending" ? (
        <div className={styles.result} data-status="pending">
          <strong>OPERACIÓN EN VERIFICACIÓN.</strong>
          <span>
            No vuelvas a intentar el cargo. Actualizaremos el estado cuando Mercado Pago
            lo confirme.
          </span>
        </div>
      ) : null}
      {message ? <p className={styles.message}>{message}</p> : null}
      <CardPayment
        initialization={{ amount, payer: { email: customerEmail } }}
        locale="es-MX"
        onError={() => setMessage("Revisa los datos del formulario de pago.")}
        onSubmit={async (formData, additionalData) => {
          setMessage(null);
          const response = await fetch("/api/commerce/payments/mercado-pago", {
            body: JSON.stringify({
              installments: formData.installments,
              orderReference,
              payerIdentification: formData.payer.identification
                ? {
                    number: formData.payer.identification.number,
                    type: formData.payer.identification.type
                  }
                : null,
              paymentMethodId: formData.payment_method_id,
              paymentMethodType: additionalData?.paymentTypeId ?? "credit_card",
              token: formData.token
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST"
          });
          const data = (await response.json().catch(() => null)) as {
            error?: string;
            status?: string;
            success?: boolean;
          } | null;
          if (!response.ok || !data) {
            const error = data?.error ?? "No fue posible iniciar el pago.";
            setMessage(error);
            throw new Error(error);
          }
          if (data.success) {
            setResult("approved");
            router.refresh();
            return;
          }
          setResult("pending");
          router.refresh();
        }}
      />
      <p className={styles.assurance}>
        Los datos de tarjeta son tratados por Mercado Pago. JANVIER no almacena número de
        tarjeta ni CVV.
      </p>
    </div>
  );
}
