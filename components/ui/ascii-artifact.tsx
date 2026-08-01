import styles from "./ascii-artifact.module.css";

type AsciiArtifactVariant = "calibration" | "signal" | "telemetry";

type AsciiArtifactProps = {
  className?: string;
  variant?: AsciiArtifactVariant;
};

const artifacts: Record<AsciiArtifactVariant, string> = {
  calibration: String.raw`[CAL_84]
| 01 10 01 |
| /\  /\  /\ |
|__SYNC____|`,
  signal: String.raw` .001.^
u$ON=1
Z00BAI
|.::=.|
;S<|||;
NRX^=-/`,
  telemetry: String.raw`/\  /\
::  ::
01|01
\__84__/
  ||||`
};

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AsciiArtifact({
  className,
  variant = "telemetry"
}: Readonly<AsciiArtifactProps>) {
  return (
    <pre
      aria-hidden="true"
      className={classNames(styles.artifact, className)}
      data-ascii-artifact={variant}
    >
      {artifacts[variant]}
    </pre>
  );
}
