import { useState } from "react";
import type { GameState, PendingReaction } from "../../domain/types/game.types";
import type { ActionCard, PropertyCard } from "../../domain/types/card.types";
import { PROP_COLOR } from "../components/CardFace";

interface Props {
  state: GameState;
  dispatch: (cmd: object) => void;
}

export function ReactionPanel({ state, dispatch }: Props) {
  const pr = state.pendingReaction;

  const needsPlayerAction =
    (pr?.kind === "jsnCheck" && pr.reactingPlayer === "player") ||
    (pr?.kind === "payDebt" && pr.debtor === "player") ||
    (pr?.kind === "forcedDealGive" && pr.giver === "player");

  if (!pr || !needsPlayerAction) return null;

  const modalStyle = {
    position: "fixed" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    background: "rgba(10,15,10,0.97)",
    borderRadius: 14,
    padding: "20px 28px",
    maxWidth: 380,
    width: "90vw",
    zIndex: 50,
    backdropFilter: "blur(12px)",
  };

  if (pr.kind === "jsnCheck") {
    const jsnCard = state.players.player.hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "jsn"
    );
    const blocked = pr.jsnChain % 2 === 1;
    const description = describeAction(pr, state);

    return (
      <div style={{ ...modalStyle, border: "1px solid rgba(239,83,80,0.5)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#ef9a9a", marginBottom: 6 }}>
          {blocked ? "✅ You blocked it!" : "⚠️ Action played against you"}
        </div>

        {/* What is being played */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 14,
          fontSize: 12,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.5,
        }}>
          {description}
        </div>

        {blocked && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
            Your opponent may play Just Say No! to counter.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {jsnCard ? (
            <button className="hud-btn dng" onClick={() => dispatch({ type: "RespondJsn", jsnCardId: jsnCard.id })}>
              🚫 Just Say No!
            </button>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>No JSN card</div>
          )}
          <button className="hud-btn sec" onClick={() => dispatch({ type: "RespondJsn", jsnCardId: null })}>
            {blocked ? "Let it happen" : "Accept"}
          </button>
        </div>
      </div>
    );
  }

  if (pr.kind === "payDebt") {
    return (
      <div style={{ ...modalStyle, border: "1px solid rgba(255,183,77,0.4)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffcc80", marginBottom: 8 }}>
          💸 Pay ${pr.amountOwed}M
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>
          Select bank cards to pay. If you can't cover it, pay everything you have.
        </div>
        <DebtPicker state={state} amountOwed={pr.amountOwed} triggerSeq={pr.triggerSeq} dispatch={dispatch} />
      </div>
    );
  }

  return null;
}

// ── Action description ────────────────────────────────────────────────────────

function describeAction(pr: Extract<PendingReaction, { kind: "jsnCheck" }>, state: GameState): string {
  const allPlayerProps = Object.values(state.players.player.sets).flat();
  const allAiProps     = Object.values(state.players.ai.sets).flat();

  switch (pr.actionKind) {
    case "rent": {
      const amount = pr.doubled ? (pr.baseAmount ?? 0) * 2 : (pr.baseAmount ?? 0);
      const colorLabel = pr.color ? ` (${pr.color})` : "";
      return `Opponent is charging${pr.doubled ? " double" : ""} rent on their${colorLabel} set — you owe $${amount}M`;
    }
    case "debtcollector":
      return "Opponent played Debt Collector — you owe $5M";
    case "birthday":
      return "Opponent played It's My Birthday — you owe $2M";
    case "slydeal": {
      const card = allPlayerProps.find(c => c.id === pr.targetCardId);
      return card
        ? `Opponent is stealing your ${card.name} (${card.color})`
        : "Opponent is stealing one of your properties";
    }
    case "forceddeal": {
      const targetCard  = allPlayerProps.find(c => c.id === pr.targetCardId);
      const offeredCard = allAiProps.find(c => c.id === pr.offeredCardId);
      if (targetCard && offeredCard) {
        return `Opponent wants to swap their ${offeredCard.name} (${offeredCard.color}) for your ${targetCard.name} (${targetCard.color})`;
      }
      return "Opponent wants to force a property swap";
    }
    case "dealbreaker":
      return pr.color
        ? `Opponent is stealing your complete ${pr.color} set!`
        : "Opponent is stealing one of your complete sets!";
    default:
      return "An action is being played against you.";
  }
}

// ── Debt picker ───────────────────────────────────────────────────────────────

function DebtPicker({
  state, amountOwed, triggerSeq, dispatch,
}: { state: GameState; amountOwed: number; triggerSeq: number; dispatch: (cmd: object) => void }) {
  const player = state.players.player;

  const bankTotal = player.bank.reduce((s, c) => s + c.value, 0);
  const bankCoversDebt = bankTotal >= amountOwed;

  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);

  const activeBankIds = bankCoversDebt ? selectedBankIds : player.bank.map(c => c.id);

  function toggleBank(id: string) {
    if (!bankCoversDebt) return;
    setSelectedBankIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleProp(id: string) {
    setSelectedPropIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const selectedBank  = player.bank.filter(c => activeBankIds.includes(c.id));
  const allProps      = (Object.values(player.sets) as PropertyCard[][]).flat();
  const selectedProps = allProps.filter(c => selectedPropIds.includes(c.id));

  const paidTotal  = selectedBank.reduce((s, c) => s + c.value, 0) + selectedProps.reduce((s, c) => s + c.value, 0);
  const totalOwned = bankTotal + allProps.reduce((s, c) => s + c.value, 0);
  const canConfirm = paidTotal >= amountOwed || paidTotal >= totalOwned;

  function confirm() {
    dispatch({ type: "PayDebt", bankCards: selectedBank, propertyCards: selectedProps, triggerSeq });
    setSelectedBankIds([]);
    setSelectedPropIds([]);
  }

  const stillOwed = Math.max(0, amountOwed - paidTotal);

  return (
    <div>
      {/* Bank cards */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "#81c784", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
        {bankCoversDebt ? "Select bank cards to pay" : `Bank (all auto-included — $${bankTotal}M)`}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {player.bank.map(c => {
          const sel = activeBankIds.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggleBank(c.id)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#fff",
              cursor: bankCoversDebt ? "pointer" : "default",
              background: sel ? "rgba(255,215,64,0.18)" : "rgba(255,255,255,0.06)",
              border: sel ? "2px solid #ffd740" : "2px solid rgba(255,255,255,0.12)",
              opacity: bankCoversDebt ? 1 : 0.7,
            }}>
              ${c.value}M
            </button>
          );
        })}
        {player.bank.length === 0 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Bank is empty</span>
        )}
      </div>

      {/* Property cards — shown when bank isn't enough */}
      {!bankCoversDebt && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ffcc80", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
            Select properties to cover remaining ${stillOwed}M
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {allProps.map(c => {
              const sel = selectedPropIds.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleProp(c.id)} style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, color: "#fff",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  background: sel ? "rgba(255,152,0,0.22)" : "rgba(255,255,255,0.06)",
                  border: sel ? "2px solid #ff9800" : "2px solid rgba(255,255,255,0.12)",
                }}>
                  <span style={{
                    display: "inline-block", width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: PROP_COLOR[c.color],
                    border: "1px solid rgba(0,0,0,0.25)",
                  }} />
                  <span>
                    <span style={{ fontWeight: 700, textTransform: "capitalize", color: "rgba(255,255,255,0.7)", fontSize: 10 }}>{c.color} · </span>
                    {c.name} (${c.value}M)
                  </span>
                </button>
              );
            })}
            {allProps.length === 0 && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>No properties</span>
            )}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
        Paying: <strong style={{ color: "#fff" }}>${paidTotal}M</strong> / ${amountOwed}M owed
        {paidTotal >= amountOwed && <span style={{ color: "#a5d6a7", marginLeft: 8 }}>✓ covered</span>}
        {paidTotal < amountOwed && paidTotal >= totalOwned && <span style={{ color: "#ffcc80", marginLeft: 8 }}>paying everything you have</span>}
      </div>
      <button className="hud-btn wrn" disabled={!canConfirm} onClick={confirm}>
        Pay ${paidTotal}M
      </button>
    </div>
  );
}
