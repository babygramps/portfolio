import styles from './MeltingClock.module.scss'

/**
 * Dali-style melting clock shown while availabilities load. Rendered in Blender from /art/melting-clock.
 * The images live in public/ rather than being imported, because Next 13 inlines an imported
 * animated image into the JS bundle as its blur placeholder.
 */
const MeltingClock = () => <picture className={styles.clock}>
  <source media="(prefers-reduced-motion: reduce)" srcSet="/scheduling/melting-clock-still.webp" />
  <img src="/scheduling/melting-clock.webp" width={160} height={240} alt="Loading event" />
</picture>

export default MeltingClock
