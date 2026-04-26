interface Props {
  onClose: () => void;
}

export function HowToPlayOverlay({ onClose }: Props) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>How to Play</div>
            <div style={styles.subtitle}>Monopoly Deal</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Left column */}
          <div style={styles.col}>
            <Section heading="Goal">
              Be first to collect <strong>3 complete property sets</strong> of different colours.
            </Section>

            <Section heading="Each Turn">
              <ol style={styles.ol}>
                <li><strong>Draw 2 cards</strong> from the deck.</li>
                <li><strong>Play up to 3 cards</strong> — or pass.</li>
                <li>Discard to <strong>7 cards</strong> at end of turn.</li>
              </ol>
            </Section>

            <Section heading="Playing Cards">
              <Row icon="🏠" label="Property" desc="Place in your property area." />
              <Row icon="💵" label="Money / Action" desc="Bank it for its dollar value." />
              <Row icon="⚡" label="Action" desc="Play the effect immediately." />
            </Section>

            <Section heading="Complete Sets">
              <div style={styles.sets}>
                <SetBadge color="#6d4c41" label="Brown" n={2} />
                <SetBadge color="#29b6f6" label="L.Blue" n={3} />
                <SetBadge color="#ec407a" label="Pink" n={3} />
                <SetBadge color="#ff7043" label="Orange" n={3} />
                <SetBadge color="#e53935" label="Red" n={3} />
                <SetBadge color="#fdd835" label="Yellow" n={3} textDark />
                <SetBadge color="#43a047" label="Green" n={3} />
                <SetBadge color="#1565c0" label="D.Blue" n={2} />
                <SetBadge color="#37474f" label="Cafe" n={4} />
                <SetBadge color="#78909c" label="Utility" n={2} />
              </div>
            </Section>
          </div>

          {/* Right column */}
          <div style={styles.col}>
            <Section heading="Key Action Cards">
              <div style={styles.actionGrid}>
                <Row icon="🎲" label="Pass Go" desc="Draw 2 extra cards." />
                <Row icon="💰" label="Debt Collector" desc="Collect $5M from any player." />
                <Row icon="🎂" label="It's My Birthday" desc="Collect $2M from everyone." />
                <Row icon="🕵️" label="Sly Deal" desc="Steal one property from an incomplete set." />
                <Row icon="🔄" label="Forced Deal" desc="Swap one of your props for one of theirs." />
                <Row icon="💥" label="Deal Breaker" desc="Steal a complete property set." />
                <Row icon="🏠" label="House / Hotel" desc="Add to a complete set to boost rent." />
                <Row icon="🚫" label="Just Say No!" desc="Cancel any action played against you." />
                <Row icon="✖️" label="Double the Rent" desc="Double your next rent charge." />
              </div>
            </Section>
          </div>
        </div>

        <button onClick={onClose} style={styles.btn}>
          Got it — let's play!
        </button>
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#81c784", marginBottom: 4 }}>
        {heading}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 3, alignItems: "flex-start" }}>
      <span style={{ width: 18, flexShrink: 0, fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 12 }}>
        <strong style={{ color: "#fff" }}>{label}</strong>
        {" — "}
        {desc}
      </span>
    </div>
  );
}

function SetBadge({ color, label, n, textDark }: { color: string; label: string; n: number; textDark?: boolean }) {
  return (
    <div style={{
      background: color,
      color: textDark ? "#212121" : "#fff",
      borderRadius: 5,
      padding: "3px 6px",
      fontSize: 10,
      fontWeight: 700,
      whiteSpace: "nowrap",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
    }}>
      <span>{label}</span>
      <span style={{ fontSize: 9, opacity: 0.85 }}>×{n}</span>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    backdropFilter: "blur(6px)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  modal: {
    background: "rgba(10,18,12,0.97)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: "16px 20px 14px",
    width: "100%",
    maxWidth: 640,
    maxHeight: "96vh",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    color: "#e8f5e9",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexShrink: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#fff",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    borderRadius: 8,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
  },
  body: {
    display: "flex",
    gap: 20,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  col: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  ol: {
    margin: "2px 0",
    paddingLeft: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    fontSize: 12,
  },
  actionGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  },
  sets: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  btn: {
    flexShrink: 0,
    padding: "10px 0",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #43a047, #1b5e20)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 4px 18px rgba(67,160,71,0.45)",
    letterSpacing: 0.3,
  },
};
