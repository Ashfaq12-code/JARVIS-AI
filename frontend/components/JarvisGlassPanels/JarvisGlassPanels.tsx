"use client";

import styles from "./JarvisGlassPanels.module.css";
import type { SystemTelemetry } from "../SystemHUD/SystemHUD";

type JarvisGlassPanelsProps = {
  telemetry: SystemTelemetry | null;
  connected: boolean;
  activeCommand?: string;
};

export default function JarvisGlassPanels({
  telemetry,
  connected,
  activeCommand,
}: JarvisGlassPanelsProps) {
  const cpuVal = telemetry?.cpu ? Math.round(telemetry.cpu) : 18;
  const ramVal = telemetry?.ram_percent ? Math.round(telemetry.ram_percent) : 42;
  const diskVal = telemetry?.disk_percent ? Math.round(telemetry.disk_percent) : 35;
  const volVal = telemetry?.volume ?? 45;

  return (
    <div className={styles.radialHUD}>
      {/* 1. SALES REPORT PANEL (Top Left) */}
      <div className={`${styles.glassPanel} ${styles.posTopLeft}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>SALES / REALTIME</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.label}>TODAY VOLUME</span>
          <strong className={styles.value}>$14,820</strong>
        </div>
        <div className={styles.meter}>
          <div className={styles.fill} style={{ width: "74%" }} />
        </div>
        <div className={styles.metaRow}>
          <span>CONVERSION</span>
          <span className={styles.activeText}>+12.4%</span>
        </div>
      </div>

      {/* 2. REVENUE TRACKING (Mid-Top Left) */}
      <div className={`${styles.glassPanel} ${styles.posMidTopLeft}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>REVENUE TRACK</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.label}>NET PROFIT</span>
          <strong className={styles.goldValue}>$94,250</strong>
        </div>
        <div className={styles.meter}>
          <div className={`${styles.fill} ${styles.goldFill}`} style={{ width: "88%" }} />
        </div>
        <div className={styles.metaRow}>
          <span>MARGIN</span>
          <span className={styles.goldText}>38.6%</span>
        </div>
      </div>

      {/* 3. DAILY WORK OVERVIEW (Mid-Bottom Left) */}
      <div className={`${styles.glassPanel} ${styles.posMidBottomLeft}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>DAILY WORK / TASKS</span>
        </div>
        <div className={styles.taskList}>
          <div><span>• CLIENT PIPELINE</span><strong className={styles.activeText}>SYNCED</strong></div>
          <div><span>• CLOUD REPOSITORY</span><strong className={styles.activeText}>PUSHED</strong></div>
          <div><span>• ARCHITECTURE AUDIT</span><strong>PASS</strong></div>
        </div>
      </div>

      {/* 4. WEB SEARCH STATUS (Bottom Left) */}
      <div className={`${styles.glassPanel} ${styles.posBottomLeft}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>SEARCH MONITOR</span>
        </div>
        <div className={styles.singleLine}>
          <span>QUERY</span>
          <strong className={styles.truncate}>{activeCommand ? activeCommand.slice(0, 18) : "STANDBY"}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>INDEX</span>
          <span className={styles.activeText}>GLOBAL READY</span>
        </div>
      </div>

      {/* 5. PERMISSIONS & SECURITY STATUS (Top Right) */}
      <div className={`${styles.glassPanel} ${styles.posTopRight}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>SECURITY / SHIELD</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.label}>FIREWALL</span>
          <strong className={styles.activeText}>ACTIVE</strong>
        </div>
        <div className={styles.meter}>
          <div className={styles.fill} style={{ width: "100%" }} />
        </div>
        <div className={styles.metaRow}>
          <span>INTEGRITY</span>
          <span>SECURE // LEVEL 4</span>
        </div>
      </div>

      {/* 6. DEVICE STATUS (Mid-Top Right) */}
      <div className={`${styles.glassPanel} ${styles.posMidTopRight}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>DEVICE STATUS</span>
        </div>
        <div className={styles.taskList}>
          <div><span>AUDIO CORE</span><strong className={styles.goldText}>VOL {volVal}%</strong></div>
          <div><span>MIC STREAM</span><strong className={styles.activeText}>ONLINE</strong></div>
          <div><span>LINK</span><strong className={connected ? styles.activeText : styles.warnText}>{connected ? "HOST CONNECTED" : "OFFLINE"}</strong></div>
        </div>
      </div>

      {/* 7. LIVE WORKFLOW STATUS (Mid-Bottom Right) */}
      <div className={`${styles.glassPanel} ${styles.posMidBottomRight}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>LIVE WORKFLOW</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.label}>ENGINE STATUS</span>
          <strong className={styles.activeText}>RUNNING</strong>
        </div>
        <div className={styles.meter}>
          <div className={styles.fill} style={{ width: "92%" }} />
        </div>
        <div className={styles.metaRow}>
          <span>LATENCY</span>
          <span>4ms // ULTRA FAST</span>
        </div>
      </div>

      {/* 8. SYSTEM SHUTDOWN & CONTROL (Bottom Right) */}
      <div className={`${styles.glassPanel} ${styles.posBottomRight}`}>
        <div className={styles.panelHead}>
          <span className={styles.glowDot} />
          <span>OPERATIONAL CONTROL</span>
        </div>
        <div className={styles.singleLine}>
          <span>VOICE CMD</span>
          <span className={styles.activeText}>VOICE-FIRST READY</span>
        </div>
        <div className={styles.metaRow}>
          <span>SYS POWER</span>
          <strong className={styles.activeText}>NORMAL OPS</strong>
        </div>
      </div>
    </div>
  );
}
