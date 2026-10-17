import type { ReactNode } from "react";
import { FRAMES, KINDS, VIEW, shapePath, type SceneId } from "@/components/arc/blocks/empty-states/empty-states-art";
import styles from "@/components/arc/blocks/empty-states/empty-states.module.css";

/**
 * One still scene from Arc's empty-states block (its drawing and styles, without the tabs or morphing):
 * "search" for start and no results, "map" for something that isn't there, "offline" when GitHub doesn't answer,
 * "inbox" for a feed with nothing in it yet.
 */
export function ExploreEmpty({ scene, title, line, action }: { scene: SceneId; title: string; line: string; action?: ReactNode }) {
  const frame = FRAMES[scene].idle;
  return (
    <section className={styles.root}>
      <div className={styles.card}>
        <div className={styles.panel}>
          <div className={styles.stage}>
            <svg className={styles.art} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={frame.label}>
              {frame.prims.map((p, i) => {
                const { d, dash } = shapePath(KINDS[i]!, p.geo, p.fx[1], 0, 0);
                return <path key={i} className={styles.shape} data-kind={KINDS[i]} data-tone={p.tone} d={d} opacity={p.fx[0]} strokeDasharray={dash} />;
              })}
            </svg>
          </div>
          <div className={styles.copy}>
            <div className={styles.copyInner}>
              <h2 className={styles.title}>{title}</h2>
              <p className={styles.line}>{line}</p>
            </div>
            {action}
          </div>
        </div>
      </div>
    </section>
  );
}
