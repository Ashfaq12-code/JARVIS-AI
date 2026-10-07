import styles from "./SystemHUD.module.css";

export type SystemTelemetry = {
  cpu?: number;
  ram_percent?: number;
  disk_percent?: number;
  volume?: number;
  platform?: string;
  status?: string;
};

type SystemHUDProps = {
  telemetry: SystemTelemetry | null;
  connected: boolean;
};

function value(value: number | undefined, suffix = "%") {
  return typeof value === "number" ? `${Math.round(value)}${suffix}` : "N/A";
}

export default function SystemHUD({ telemetry, connected }: SystemHUDProps) {
  const rows = [
    { label: "CPU", value: value(telemetry?.cpu), meter: telemetry?.cpu },
    { label: "MEMORY", value: value(telemetry?.ram_percent), meter: telemetry?.ram_percent },
    { label: "DISK", value: value(telemetry?.disk_percent), meter: telemetry?.disk_percent },
    { label: "GPU", value: "UNAVAILABLE", meter: undefined },
  ];

  return (
    <section className={styles.panel} aria-label="System telemetry">
      <div className={styles.panelHead}><span className={styles.signal} /> SYSTEM / DATA</div>
      <div className={styles.connection}>{connected ? "BACKEND LINK ACTIVE" : "BACKEND LINK OFFLINE"}</div>
      <div className={styles.rows}>
        {rows.map((row) => (
          <div className={styles.row} key={row.label}>
            <div className={styles.rowTop}><span>{row.label}</span><strong>{row.value}</strong></div>
            <div className={styles.meter}><i style={{ width: `${row.meter ?? 0}%` }} /></div>
          </div>
        ))}
      </div>
      <div className={styles.footerRows}>
        <span>NETWORK</span><strong className={connected ? styles.active : styles.warning}>{connected ? "ONLINE" : "OFFLINE"}</strong>
        <span>VOLUME</span><strong>{value(telemetry?.volume)}</strong>
        <span>UPTIME</span><strong>UNAVAILABLE</strong>
      </div>
    </section>
  );
}