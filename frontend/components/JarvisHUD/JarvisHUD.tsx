import styles from "./JarvisHUD.module.css";

type JarvisHUDProps = {
  face: React.ReactNode;
  top: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  bottom: React.ReactNode;
};

export default function JarvisHUD({ face, top, left, right, bottom }: JarvisHUDProps) {
  return (
    <div className={styles.hud}>
      <header className={styles.top}>{top}</header>
      <aside className={`${styles.side} ${styles.left}`}>{left}</aside>
      <main className={styles.center}>{face}</main>
      <aside className={`${styles.side} ${styles.right}`}>{right}</aside>
      <footer className={styles.bottom}>{bottom}</footer>
    </div>
  );
}