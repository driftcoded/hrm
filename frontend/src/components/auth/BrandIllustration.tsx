import styles from './BrandIllustration.module.css';

/**
 * Decorative, purely geometric illustration for the auth brand panel.
 *
 * NOTE: this is a lightweight placeholder built from primitives so the layout
 * has the intended visual weight without shipping (or copying) any artwork.
 * A designer-supplied asset should replace it — see the report for Giai đoạn 1.2.
 * All colors come from the CSS module, i.e. from the design tokens.
 */
export function BrandIllustration() {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 520 300"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      {/* Soft background blobs */}
      <circle className={styles.blobBlue} cx="120" cy="120" r="96" />
      <circle className={styles.blobAccent} cx="404" cy="96" r="72" />
      <circle className={styles.blobSuccess} cx="330" cy="238" r="58" />

      {/* Main "dashboard" card */}
      <rect className={styles.cardShadow} x="88" y="72" width="304" height="188" rx="18" />
      <rect className={styles.card} x="80" y="62" width="304" height="188" rx="18" />

      {/* Card header */}
      <rect className={styles.lineStrong} x="104" y="88" width="112" height="10" rx="5" />
      <rect className={styles.lineMuted} x="104" y="108" width="72" height="8" rx="4" />

      {/* Bar chart */}
      <rect className={styles.barBlue} x="104" y="188" width="26" height="38" rx="7" />
      <rect className={styles.barBlueStrong} x="142" y="164" width="26" height="62" rx="7" />
      <rect className={styles.barSuccess} x="180" y="142" width="26" height="84" rx="7" />
      <rect className={styles.barAccent} x="218" y="176" width="26" height="50" rx="7" />
      <rect className={styles.axis} x="104" y="230" width="140" height="4" rx="2" />

      {/* Trend line + node */}
      <path className={styles.trend} d="M268 206 300 176 332 190 364 140" />
      <circle className={styles.trendNode} cx="364" cy="140" r="7" />

      {/* Floating "employee record" chip */}
      <rect className={styles.chipShadow} x="292" y="222" width="176" height="60" rx="16" />
      <rect className={styles.chip} x="284" y="214" width="176" height="60" rx="16" />
      <circle className={styles.avatar} cx="316" cy="244" r="16" />
      <rect className={styles.lineStrong} x="342" y="234" width="88" height="9" rx="4" />
      <rect className={styles.lineMuted} x="342" y="250" width="60" height="7" rx="3" />

      {/* Floating status pill */}
      <rect className={styles.pill} x="376" y="52" width="104" height="34" rx="17" />
      <circle className={styles.pillDot} cx="396" cy="69" r="6" />
      <rect className={styles.pillLine} x="410" y="65" width="52" height="8" rx="4" />
    </svg>
  );
}
