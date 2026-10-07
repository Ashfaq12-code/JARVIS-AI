import styles from "./ActivityPanel.module.css";

type ActivityPanelProps = {
  title: string;
  items: Array<{ label: string; value: string; tone?: "normal" | "active" | "warning" }>;
};

export default function ActivityPanel({ title, items }: ActivityPanelProps) {
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.heading}><span />{title}</div>
      <div className={styles.rules} />
      <dl>
        {items.map((item) => (
          <div className={styles.item} key={item.label}>
            <dt>{item.label}</dt>
            <dd className={item.tone ? styles[item.tone] : undefined}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}