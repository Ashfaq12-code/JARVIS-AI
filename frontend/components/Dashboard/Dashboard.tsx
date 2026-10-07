import JarvisHUD from "../JarvisHUD/JarvisHUD";
import styles from "./Dashboard.module.css";

type DashboardProps = {
  face: React.ReactNode;
  top: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  bottom: React.ReactNode;
  developerTools: React.ReactNode;
  children?: React.ReactNode;
};

export default function Dashboard({ face, top, left, right, bottom, developerTools, children }: DashboardProps) {
  return (
    <main className={styles.dashboard}>
      <JarvisHUD face={face} top={top} left={left} right={right} bottom={bottom} />
      <details className={styles.developerTools}>
        <summary>Development controls</summary>
        <div>{developerTools}</div>
      </details>
      {children}
    </main>
  );
}