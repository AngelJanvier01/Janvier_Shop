import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { customerSessionCookieName, getCustomerFromSessionToken } from "./customer-session";

export async function getCurrentCustomer() {
  const cookieStore = await cookies();
  return getCustomerFromSessionToken(cookieStore.get(customerSessionCookieName)?.value);
}

export async function requireCurrentCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/suministro/acceso");
  }
  return customer;
}
