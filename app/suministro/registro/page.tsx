import Link from "next/link";

import { CustomerEnrollmentForm } from "@/components/commerce/customer-enrollment-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import styles from "./page.module.css";

export const metadata = {
  title: "Cuenta comercial",
  description:
    "Solicita una cuenta comercial JANVIER para consultar precios, cotizaciones y disponibilidad."
};

export default function CustomerEnrollmentPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.introduction}>
          <div>
            <p>CLIENT_ACCESS / REVIEWED_PRICING</p>
            <h1>Abre tu cuenta comercial.</h1>
            <span>
              Validamos tu perfil para mostrarte precios, cotizaciones y disponibilidad.
            </span>
          </div>
          <CustomerEnrollmentForm />
        </section>
        <aside className={styles.sequence}>
          <div aria-hidden="true" className={styles.artifact}>
            [CAL_01]
            <br />
            | 01 01 |
            <br />
            | /\ /\ |
            <br />
            |__SYNC__|
          </div>
          <ol>
            <li>
              <b>01</b>
              <span>VERIFICAMOS TU CORREO</span>
            </li>
            <li>
              <b>02</b>
              <span>REVISAMOS TU PERFIL</span>
            </li>
            <li>
              <b>03</b>
              <span>ACTIVAMOS TU CUENTA</span>
            </li>
          </ol>
          <div className={styles.assurance}>
            <p>● &nbsp; EL REGISTRO NO REQUIERE UNA COMPRA.</p>
            <Link href="/suministro/acceso">¿YA TIENES UNA CUENTA? INICIA SESIÓN</Link>
          </div>
          <p className={styles.system}>
            JANVIER / CLIENT_ACCESS
            <br />● SYSTEM_READY
          </p>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
