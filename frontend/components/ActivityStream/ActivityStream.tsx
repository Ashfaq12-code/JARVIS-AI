import styles from "./ActivityStream.module.css";

export type ActivityEvent = {
  id: number;
  label: string;
  detail?: string;
  timestamp: string;
};

type ActivityStreamProps = {
  events: ActivityEvent[];
};

export default function ActivityStream({ events }: ActivityStreamProps) {
  return (
    <section className={styles.stream} aria-label="JARVIS activity stream">
      <div className={styles.heading}><span /> ACTIVITY / LIVE</div>
      <div className={styles.line} />
      {events.length === 0 ? (
        <p className={styles.empty}>Awaiting activity</p>
      ) : (
        <ol>
          {events.slice(0, 5).map((event) => (
            <li key={event.id}>
              <time>{event.timestamp}</time>
              <span>{event.label}</span>
              {event.detail && <small>{event.detail}</small>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}