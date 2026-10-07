import styles from "./JarvisFace.module.css";

export type JarvisFaceState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "ERROR";

type JarvisFaceProps = {
  state: JarvisFaceState;
};

const stateCopy: Record<JarvisFaceState, string> = {
  IDLE: "STANDBY",
  LISTENING: "LISTENING",
  THINKING: "PROCESSING",
  SPEAKING: "RESPONDING",
  ERROR: "SYSTEM ALERT",
};

export default function JarvisFace({ state }: JarvisFaceProps) {
  return (
    <section className={`${styles.faceStage} ${styles[state.toLowerCase()]}`} aria-label={`JARVIS face ${state.toLowerCase()}`}>
      <div className={styles.scanField} aria-hidden="true" />
      <div className={`${styles.orbit} ${styles.orbitOne}`} aria-hidden="true" />
      <div className={`${styles.orbit} ${styles.orbitTwo}`} aria-hidden="true" />
      <div className={styles.particles} aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
      </div>

      <div className={styles.face} aria-hidden="true">
        <div className={styles.foreheadLine} />
        <div className={`${styles.temple} ${styles.templeLeft}`} />
        <div className={`${styles.temple} ${styles.templeRight}`} />
        <div className={`${styles.brow} ${styles.browLeft}`} />
        <div className={`${styles.brow} ${styles.browRight}`} />
        <div className={`${styles.eye} ${styles.eyeLeft}`}><span /></div>
        <div className={`${styles.eye} ${styles.eyeRight}`}><span /></div>
        <div className={styles.noseBridge} />
        <div className={`${styles.cheek} ${styles.cheekLeft}`} />
        <div className={`${styles.cheek} ${styles.cheekRight}`} />
        <div className={styles.jaw} />
        <div className={styles.mouth}><span /><span /><span /></div>
        <div className={styles.chinMark} />
      </div>

      <div className={styles.statusTag}>
        <span className={styles.statusDot} />
        {stateCopy[state]}
      </div>
      <div className={`${styles.corner} ${styles.cornerTopLeft}`} />
      <div className={`${styles.corner} ${styles.cornerTopRight}`} />
      <div className={`${styles.corner} ${styles.cornerBottomLeft}`} />
      <div className={`${styles.corner} ${styles.cornerBottomRight}`} />
    </section>
  );
}