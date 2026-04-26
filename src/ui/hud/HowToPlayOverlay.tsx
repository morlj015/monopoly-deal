interface Props {
  onClose: () => void;
}

export function HowToPlayOverlay({ onClose }: Props) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.title}>How to Play</div>
        <div style={styles.subtitle}>Monopoly Deal</div>

        <div style={styles.sections}>
          <Section heading="Goal">
            Be the first player to collect <strong>3 complete property sets</strong> of different colours.
          </Section>

          <Section heading="Each Turn">
            <ol style={styles.ol}>
              <li><strong>Draw 2 cards</strong> from the deck.</li>
              <li><strong>Play up to 3 cards</strong> — or pass if you don't want to play any.</li>
              <li>If you have more than <strong>7 cards</strong> in hand at the end of your turn, discard down to 7.</li>
            </ol>
          </Section>

          <Section heading="Playing Cards">
            <Row icon="🏠" label="Property" desc="Place face-up in your property area." />
            <Row icon="💵" label="Money / Action card" desc="Bank it face-up for its dollar value." />
            <Row icon="⚡" label="Action card" desc="Play the effect immediately." />
          </Section>

          <Section heading="Key Action Cards">
            <Row icon="🎲" label="Pass Go" desc="Draw 2 extra cards." />
            <Row icon="💰" label="Debt Collector" desc="Collect $5M from any player." />
            <Row icon="🎂" label="It's My Birthday" desc="Collect $2M from every player." />
            <Row icon="🕵️" label="Sly Deal" desc="Steal one property from an incomplete set." />
            <Row icon="🔄" label="Forced Deal" desc="Swap one of your properties for one of theirs." />
            <Row icon="💥" label="Deal Breaker" desc="Steal a complete property set." />
            <Row icon="🏠" label="House / Hotel" desc="Add to a complete set to increase its rent." />
            <Row icon="🚫" label="Just Say No!" desc="Cancel any action played against you." />
          </Section>

          <Section heading="Complete Sets">
            Brown&nbsp;2 · Light Blue&nbsp;3 · Pink&nbsp;3 · Orange&nbsp;3 · Red&nbsp;3 · Yellow&nbsp;3 · Green&nbsp;3 · Dark Blue&nbsp;2 · Cafe&nbsp;4 · Utility&nbsp;2
          </Section>
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
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#81c784", marginBottom: 6 }}>
        {heading}
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
      <span style={{ width: 20, flexShrink: 0, fontSize: 14 }}>{icon}</span>
      <span>
        <strong style={{ color: "#fff" }}>{label}</strong>
        {" — "}
        {desc}
      </span>
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
    padding: 16,
  },
  modal: {
    background: "rgba(10,18,12,0.97)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "28px 30px 24px",
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    color: "#e8f5e9",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  title: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  sections: {
    flex: 1,
  },
  ol: {
    margin: "4px 0",
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  btn: {
    marginTop: 18,
    padding: "13px 0",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #43a047, #1b5e20)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 4px 18px rgba(67,160,71,0.45)",
    letterSpacing: 0.3,
  },
};
