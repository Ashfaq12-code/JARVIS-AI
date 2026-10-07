import styles from "./EnergyField.module.css";

type EnergyFieldProps = { children: React.ReactNode };

export default function EnergyField({ children }: EnergyFieldProps) {
  return (
    <div className={styles.field}>
      <div className={`${styles.ring} ${styles.ringOne}`} />
      <div className={`${styles.ring} ${styles.ringTwo}`} />
      <div className={`${styles.arc} ${styles.arcOne}`} />
      <div className={`${styles.arc} ${styles.arcTwo}`} />
      <div className={`${styles.radial} ${styles.radialOne}`} />
      <div className={`${styles.radial} ${styles.radialTwo}`} />
      <div className={`${styles.connection} ${styles.connectionLeft}`} />
      <div className={`${styles.connection} ${styles.connectionRight}`} />
      <div className={`${styles.connection} ${styles.connectionBottom}`} />
      <div className={styles.core}>{children}</div>
    </div>
  );
}