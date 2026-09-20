import { NextResponse } from "next/server";

import {
  createCustomerEnrollment,
  customerEnrollmentInput,
  markCustomerVerificationDelivery,
  sendCustomerVerificationEmail,
  verificationEmailDeliveryIsConfigured
} from "@/lib/customer-accounts/enrollment";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }

  const payload: unknown = await request.json().catch(() => null);
  const parsed = customerEnrollmentInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa los datos de tu solicitud." },
      { status: 400 }
    );
  }

  const botPayload = payload as { formOpenedAt?: unknown; website?: unknown } | null;
  const openedAt =
    typeof botPayload?.formOpenedAt === "number" ? botPayload.formOpenedAt : Number.NaN;
  const honeypotFilled =
    typeof botPayload?.website === "string" && botPayload.website.trim();
  if (honeypotFilled || !Number.isFinite(openedAt) || Date.now() - openedAt < 1_200) {
    // Do not help automated clients distinguish a trap from a valid submission.
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.toLowerCase();
  const rateError = await assertRequestRate(
    request,
    email,
    "customer-enrollment",
    4,
    15 * 60_000
  );
  if (rateError) {
    return rateError;
  }

  if (!(await verificationEmailDeliveryIsConfigured())) {
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
    await markCustomerVerificationDelivery(
      enrollment.verificationId,
      "FAILED",
      delivery.error
    );
    return NextResponse.json(
      { error: "No fue posible enviar la verificación. Intenta de nuevo más tarde." },
      { status: 503 }
    );
  }

  await markCustomerVerificationDelivery(enrollment.verificationId, "QUEUED");
  return NextResponse.json({ ok: true });
}
