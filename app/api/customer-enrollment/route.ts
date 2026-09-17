import { NextResponse } from "next/server";

import {
  createCustomerEnrollment,
  customerEnrollmentInput,
  markCustomerVerificationDelivery,
  sendCustomerVerificationEmail,
  verificationEmailDeliveryIsConfigured
} from "@/lib/customer-accounts/enrollment";
import { assertRequestRate, assertSameOriginMutation } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }

  const parsed = customerEnrollmentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa los datos de tu solicitud." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const rateError = assertRequestRate(request, email, "customer-enrollment", 4, 15 * 60_000);
  if (rateError) {
    return rateError;
  }

  if (!verificationEmailDeliveryIsConfigured()) {
    return NextResponse.json(
      { error: "El registro está en preparación. Vuelve a intentarlo muy pronto." },
      { status: 503 }
    );
  }

  const enrollment = await createCustomerEnrollment(parsed.data);
  if (!enrollment) {
    return NextResponse.json({ ok: true });
  }

  const delivery = await sendCustomerVerificationEmail(enrollment);
  if (delivery.error) {
    await markCustomerVerificationDelivery(enrollment.verificationId, "FAILED", delivery.error);
    return NextResponse.json(
      { error: "No fue posible enviar la verificación. Intenta de nuevo más tarde." },
      { status: 503 }
    );
  }

  await markCustomerVerificationDelivery(enrollment.verificationId, "SENT");
  return NextResponse.json({ ok: true });
}
