"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand/logo";

import styles from "./proposal-invite-card.module.css";

type ProposalInviteCardProps = {
  accessCode: string;
  proposalReference: string;
  proposalTitle: string;
  shareUrl: string;
};

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/(^-|-$)/gu, "");
}

async function createInvitePng(input: ProposalInviteCardProps) {
  const qr = await QRCode.toDataURL(input.shareUrl, {
    color: { dark: "#0d0f0c", light: "#eeeae1" },
    errorCorrectionLevel: "M",
    margin: 1,
    width: 520
  });
  const image = new Image();
  image.src = qr;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.height = 1120;
  canvas.width = 1600;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar la tarjeta de acceso.");
  }

  context.fillStyle = "#eeeae1";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(13, 15, 12, 0.18)";
  context.lineWidth = 1;
  for (let coordinate = 0; coordinate <= 1600; coordinate += 80) {
    context.beginPath();
    context.moveTo(coordinate, 0);
    context.lineTo(coordinate, 1120);
    context.stroke();
  }
  for (let coordinate = 0; coordinate <= 1120; coordinate += 80) {
    context.beginPath();
    context.moveTo(0, coordinate);
    context.lineTo(1600, coordinate);
    context.stroke();
  }
  context.fillStyle = "#d64d38";
  context.fillRect(100, 100, 12, 210);
  context.fillStyle = "#0d0f0c";
  context.font = "600 32px monospace";
  context.fillText("JANVIER / PROJECT_ROOM", 140, 140);
  context.font = "500 114px Arial, sans-serif";
  context.fillText("Acceso privado", 140, 300);
  context.font = "500 60px Arial, sans-serif";
  const title = input.proposalTitle.slice(0, 46);
  context.fillText(title, 140, 390);
  context.font = "600 26px monospace";
  context.fillStyle = "#4e564f";
  context.fillText(input.proposalReference, 140, 450);
  context.fillStyle = "#0d0f0c";
  context.fillRect(140, 530, 700, 2);
  context.font = "600 24px monospace";
  context.fillStyle = "#4e564f";
  context.fillText("CÓDIGO DE ACCESO", 140, 605);
  context.font = "600 76px monospace";
  context.fillStyle = "#0d0f0c";
  context.fillText(input.accessCode, 140, 695);
  context.font = "400 26px Arial, sans-serif";
  context.fillStyle = "#4e564f";
  context.fillText("Escanea el QR y usa el código para abrir la sala.", 140, 785);
  context.fillText(
    "Si JANVIER revoca esta invitación, ambos dejan de funcionar.",
    140,
    830
  );
  context.fillStyle = "#0d0f0c";
  context.fillRect(965, 155, 500, 500);
  context.drawImage(image, 985, 175, 460, 460);
  context.font = "600 22px monospace";
  context.fillStyle = "#4e564f";
  context.fillText("QR / SALA PRIVADA", 1085, 715);
  context.fillStyle = "#d64d38";
  context.fillRect(140, 930, 1325, 2);
  context.fillStyle = "#0d0f0c";
  context.font = "600 22px monospace";
  context.fillText("JANVIER / PENSADO PARA LO QUE SIGUE", 140, 990);
  context.fillStyle = "#4e564f";
  context.fillText("No reenvíes esta tarjeta sin autorización.", 140, 1035);

  return canvas.toDataURL("image/png");
}

export function ProposalInviteCard(props: ProposalInviteCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void createInvitePng(props)
      .then((value) => {
        if (active) setImageUrl(value);
      })
      .catch(() => {
        if (active) setError("No se pudo generar la tarjeta PNG.");
      });
    return () => {
      active = false;
    };
  }, [props]);

  return (
    <section className={styles.card} data-testid="proposal-invite-card">
      <header>
        <div className={styles.brand}>
          <BrandMark label="" />
          <span>JANVIER</span>
        </div>
        <span>QR / PRIVATE_ACCESS</span>
      </header>
      {imageUrl ? (
        // Canvas generates this local PNG only after the invite has been issued.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Tarjeta privada de acceso JANVIER con código y QR" src={imageUrl} />
      ) : (
        <p>{error ?? "Generando tarjeta PNG…"}</p>
      )}
      {imageUrl ? (
        <a
          download={`janvier-${safeFilePart(props.proposalReference)}-acceso.png`}
          href={imageUrl}
        >
          DESCARGAR TARJETA PNG
        </a>
      ) : null}
    </section>
  );
}
