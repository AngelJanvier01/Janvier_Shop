"use client";

import { useActionState } from "react";

import { createPortfolioProject } from "@/app/(admin)/admin/proyectos/actions";

import styles from "./project-create-form.module.css";

export function ProjectCreateForm() {
  const [state, formAction, isPending] = useActionState(createPortfolioProject, {});

  return (
    <form action={formAction} className={styles.form}>
      <div>
        <p>PROJECT_LOG / NEW_CASE</p>
        <h2>Publica evidencia, no relleno.</h2>
      </div>
      <label>
        <span>TITULO DEL CASO</span>
        <input name="title" required type="text" />
      </label>
      <label>
        <span>CONTACTO DEL CLIENTE</span>
        <input name="clientName" required type="text" />
      </label>
      <label>
        <span>ORGANIZACION</span>
        <input name="companyName" type="text" />
      </label>
      <label>
        <span>CORREO DEL CLIENTE</span>
        <input name="clientEmail" required type="email" />
      </label>
      <label className={styles.full}>
        <span>RESUMEN DEL CASO</span>
        <textarea name="summary" required rows={5} />
      </label>
      <label className={styles.publish}>
        <input name="isPublic" type="checkbox" />
        <span>El cliente autorizo publicar este caso en el portafolio.</span>
      </label>
      <button disabled={isPending} type="submit">
        {isPending ? "Guardando..." : "Guardar proyecto"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? (
        <p className={styles.success}>
          {state.success}
          {state.slug ? ` /proyectos/${state.slug}` : ""}
        </p>
      ) : null}
    </form>
  );
}
