import Link from "next/link";

import { CustomerIdleSession } from "./customer-idle-session";
import { GuestCartCount } from "./guest-cart-count";
import styles from "./supply-subheader.module.css";

type SupplySubheaderProps = {
  cartItemCount?: number;
  companyName?: string | null;
  customerName?: string | null;
};

export function SupplySubheader({
  cartItemCount = 0,
  companyName,
  customerName
}: SupplySubheaderProps) {
  const signedIn = Boolean(customerName);

  return (
    <div className={styles.shell}>
      {signedIn ? <CustomerIdleSession /> : null}
      <nav aria-label="Navegación de suministro" className={styles.inner}>
        <div className={styles.catalogLinks}>
          <Link className={styles.primary} href="/suministro/catalogo">
            CATÁLOGO
          </Link>
          <Link href="/suministro/catalogo?availability=ready">CON EXISTENCIAS</Link>
          <Link href="/suministro/registro">CUENTA COMERCIAL</Link>
        </div>

        <form action="/suministro/catalogo" className={styles.search} method="get">
          <label>
            <span className={styles.visuallyHidden}>Buscar en el catálogo</span>
            <input
              aria-label="Buscar en el catálogo"
              maxLength={120}
              name="q"
              placeholder="BUSCAR PRODUCTO, MARCA O SKU"
              type="search"
            />
          </label>
          <button type="submit">BUSCAR</button>
        </form>

        <div className={styles.customerLinks}>
          {signedIn ? (
            <Link className={styles.account} href="/suministro/mi-cuenta">
              <span>MI CUENTA</span>
              <strong>{customerName}</strong>
              {companyName ? <small>{companyName}</small> : null}
            </Link>
          ) : (
            <Link className={styles.account} href="/suministro/acceso">
              <span>CLIENTE</span>
              <strong>INGRESAR</strong>
            </Link>
          )}
          <Link className={styles.cart} href="/suministro/carrito">
            <span>CARRITO</span>
            {signedIn ? <strong>{cartItemCount}</strong> : <GuestCartCount />}
          </Link>
        </div>
      </nav>
    </div>
  );
}
