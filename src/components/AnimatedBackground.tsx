export default function AnimatedBackground() {
  return <div className="mobile-graphics" aria-hidden="true">
    <span className="mobile-graphics__orb mobile-graphics__orb--blue" />
    <span className="mobile-graphics__orb mobile-graphics__orb--mint" />
    <span className="mobile-graphics__orb mobile-graphics__orb--violet" />
    <span className="mobile-graphics__ring mobile-graphics__ring--one" />
    <span className="mobile-graphics__ring mobile-graphics__ring--two" />
    <svg className="mobile-graphics__motif mobile-graphics__motif--pill" viewBox="0 0 180 180" fill="none">
      <rect x="49" y="18" width="82" height="144" rx="41" transform="rotate(42 90 90)" stroke="currentColor" strokeWidth="4" />
      <path d="M45 67 113 135" stroke="currentColor" strokeWidth="4" />
      <circle cx="90" cy="90" r="78" stroke="currentColor" strokeWidth="2" strokeDasharray="3 12" />
    </svg>
    <svg className="mobile-graphics__motif mobile-graphics__motif--cross" viewBox="0 0 160 160" fill="none">
      <circle cx="80" cy="80" r="69" stroke="currentColor" strokeWidth="2" strokeDasharray="4 10" />
      <path d="M67 37h26v30h30v26H93v30H67V93H37V67h30V37Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  </div>;
}
