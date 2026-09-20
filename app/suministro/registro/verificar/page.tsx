import Link from "next/link";

import { CustomerEmailVerificationForm } from "@/components/commerce/customer-email-verification-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import styles from "./page.module.css";

type CustomerEmailVerificationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Confirma tu correo"
};

export default async function CustomerEmailVerificationPage({
  searchParams
}: CustomerEmailVerificationPageProps) {
  const token = (await searchParams).token?.trim() ?? "";

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section>
          <p>CONFIRMA TU CORREO</p>
          <h1>Confirma tu correo.</h1>
          <span>
            Elige una contraseña para completar la verificación. Después revisaremos tu
            solicitud comercial.
          </span>
        </section>
        {token ? (
          <CustomerEmailVerificationForm token={token} />
        ) : (
          <section className={styles.invalid}>
            <h2>Falta el enlace de verificación.</h2>
            <Link href="/suministro/registro">Volver a solicitar acceso</Link>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
