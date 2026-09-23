import Link from "next/link";

import { CustomerLoginForm } from "@/components/commerce/customer-login-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Acceso comercial"
};

type CustomerAccessPageProps = {
  searchParams: Promise<{ expired?: string }>;
};

export default async function CustomerAccessPage({
  searchParams
}: CustomerAccessPageProps) {
  const { expired } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section>
          <p>ACCESO A TU CUENTA</p>
          <h1>Entra a tu cuenta comercial.</h1>
          <span>Consulta tus precios, cotizaciones, pedidos y disponibilidad.</span>
        </section>
        <div className={styles.formArea}>
          {expired === "inactive" ? (
            <p className={styles.notice} role="status">
              Cerramos tu sesión después de 60 minutos sin actividad. Vuelve a ingresar
              para continuar.
            </p>
          ) : null}
          <CustomerLoginForm />
          <p>
            ¿AÚN NO TIENES CUENTA?{" "}
            <Link href="/suministro/registro">SOLICITA ACCESO</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
