import { useState, useRef, useEffect } from "react";
import type { Card, PropertyColor, PropertyCard } from "../../domain/types/card.types";
import type { GameState } from "../../domain/types/game.types";
import { CardFace } from "../components/CardFace";
import { isComplete, SET_SIZES } from "../../domain/rules/set.rules";
import { PROP_COLOR } from "../components/CardFace";

interface Props {
  state: GameState;
  dispatch: (cmd: object) => void;
}

type PickStep =
  | null
  | "sly-target"
  | "forced-ai-pick"
  | "forced-own-pick"
  | "dealbreaker-pick"
  | "house-pick"
  | "hotel-pick"
  | "rearrange-pick"
  | "rearrange-dest";

const DRAG_THRESHOLD = 8;

export function PlayerHand({ state, dispatch }: Props) {
  const [selected, setSelected] = useState<Card | null>(null);
  const [targetColor, setTargetColor] = useState<PropertyColor | null>(null);
  const [pickStep, setPickStep] = useState<PickStep>(null);
  const [forcedAiCardId, setForcedAiCardId] = useState<string | null>(null);
  const [discardIds, setDiscardIds] = useState<string[]>([]);
  const [rearrangeCardId, setRearrangeCardId] = useState<string | null>(null);

  // Drag state
  const pointerRef = useRef<{ card: Card; startX: number; startY: number } | null>(null);
  const [ghostCard, setGhostCard] = useState<{ card: Card; x: number; y: number } | null>(null);
  const [dropZone, setDropZone] = useState<"play" | "bank" | null>(null);
  const handRef = useRef<HTMLDivElement>(null);

  // Stable callback refs so the effect can call the latest versions
  const executeDropRef = useRef<(card: Card, zone: "play" | "bank") => void>(null!);
  const tapCardRef = useRef<(card: Card) => void>(null!);

  const player = state.players.player;
  const ai = state.players.ai;
  const isDiscard = state.phase === "discard" && state.turn.activePlayer === "player";
  const active =
    state.turn.activePlayer === "player" &&
    state.phase === "action" &&
    state.turn.playsLeft > 0;

  function reset() {
    setSelected(null);
    setTargetColor(null);
    setPickStep(null);
    setForcedAiCardId(null);
    setRearrangeCardId(null);
  }

  // ── Discard mode ──────────────────────────────────────────────────────────────

  const discardNeeded = isDiscard ? player.hand.length - 7 : 0;

  function toggleDiscard(card: Card) {
    setDiscardIds(prev => prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]);
  }

  function confirmDiscard() {
    if (discardIds.length !== discardNeeded) return;
    dispatch({ type: "DiscardCards", cardIds: discardIds });
    setDiscardIds([]);
  }

  // ── Card selection (tap) ──────────────────────────────────────────────────────

  function selectCard(card: Card) {
    if (!active) return;
    if (card.kind === "action" && card.subtype === "jsn") return;
    if (selected?.id === card.id) { reset(); return; }
    setSelected(card);
    setTargetColor(null);
    setPickStep(null);
    setForcedAiCardId(null);
  }

  // ── Play logic ────────────────────────────────────────────────────────────────

  function playAction() {
    if (!selected || selected.kind !== "action") return;
    switch (selected.subtype) {
      case "passgo":        dispatch({ type: "PlayPassGo", cardId: selected.id }); reset(); break;
      case "birthday":      dispatch({ type: "PlayBirthday", cardId: selected.id }); reset(); break;
      case "debtcollector": dispatch({ type: "PlayDebtCollector", cardId: selected.id, target: "ai" }); reset(); break;
      case "doublerent":    dispatch({ type: "PlayDoubleRent", cardId: selected.id }); reset(); break;
      case "slydeal":       setPickStep("sly-target"); break;
      case "forceddeal":    setPickStep("forced-ai-pick"); break;
      case "dealbreaker":   setPickStep("dealbreaker-pick"); break;
      case "house":         setPickStep("house-pick"); break;
      case "hotel":         setPickStep("hotel-pick"); break;
    }
  }

  function playProperty() {
    if (!selected || selected.kind !== "property") return;
    const validColors = selected.colors ?? [selected.color];
    if (validColors.length > 1 && !targetColor) {
      setTargetColor(validColors[0]);
      return;
    }
    dispatch({ type: "PlayProperty", cardId: selected.id, toColor: targetColor ?? selected.color });
    reset();
  }

  function startRent() {
    if (!selected || selected.kind !== "rent") return;
    setTargetColor(selected.colors[0] ?? null);
  }

  function playRent(color: PropertyColor) {
    if (!selected || selected.kind !== "rent") return;
    dispatch({ type: "PlayRent", cardId: selected.id, chosenColor: color });
    reset();
  }

  // ── Drag-to-play ──────────────────────────────────────────────────────────────

  function executeZoneDrop(card: Card, zone: "play" | "bank") {
    if (!active) return;

    if (zone === "bank") {
      dispatch({ type: "BankCard", cardId: card.id });
      reset();
      return;
    }

    // Play zone
    if (card.kind === "property") {
      const validColors = card.colors ?? [card.color];
      if (validColors.length > 1) {
        setSelected(card);
        setTargetColor(validColors[0]);
      } else {
        dispatch({ type: "PlayProperty", cardId: card.id, toColor: card.color });
        reset();
      }
      return;
    }

    if (card.kind === "action" && card.subtype !== "jsn") {
      setSelected(card);
      switch (card.subtype) {
        case "passgo":        dispatch({ type: "PlayPassGo", cardId: card.id }); reset(); break;
        case "birthday":      dispatch({ type: "PlayBirthday", cardId: card.id }); reset(); break;
        case "debtcollector": dispatch({ type: "PlayDebtCollector", cardId: card.id, target: "ai" }); reset(); break;
        case "doublerent":    dispatch({ type: "PlayDoubleRent", cardId: card.id }); reset(); break;
        case "slydeal":       setPickStep("sly-target"); break;
        case "forceddeal":    setPickStep("forced-ai-pick"); break;
        case "dealbreaker":   setPickStep("dealbreaker-pick"); break;
        case "house":         setPickStep("house-pick"); break;
        case "hotel":         setPickStep("hotel-pick"); break;
      }
      return;
    }

    if (card.kind === "rent") {
      setSelected(card);
      setTargetColor(card.colors[0] ?? null);
    }
  }

  // Update stable refs each render
  executeDropRef.current = executeZoneDrop;
  tapCardRef.current = selectCard;

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const pd = pointerRef.current;
      if (!pd) return;
      const dist = Math.hypot(e.clientX - pd.startX, e.clientY - pd.startY);
      if (dist < DRAG_THRESHOLD) return;

      setGhostCard({ card: pd.card, x: e.clientX, y: e.clientY });

      const handTop = handRef.current?.getBoundingClientRect().top ?? window.innerHeight;
      if (e.clientY < handTop - 30) {
        setDropZone(e.clientX < window.innerWidth * 0.65 ? "play" : "bank");
      } else {
        setDropZone(null);
      }
    }

    function onPointerUp(e: PointerEvent) {
      const pd = pointerRef.current;
      if (!pd) return;

      const dist = Math.hypot(e.clientX - pd.startX, e.clientY - pd.startY);

      if (dist >= DRAG_THRESHOLD) {
        const handTop = handRef.current?.getBoundingClientRect().top ?? window.innerHeight;
        if (e.clientY < handTop - 30) {
          const zone = e.clientX < window.innerWidth * 0.65 ? "play" : "bank";
          executeDropRef.current(pd.card, zone);
        }
      } else {
        tapCardRef.current(pd.card);
      }

      pointerRef.current = null;
      setGhostCard(null);
      setDropZone(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function onCardPointerDown(e: React.PointerEvent, card: Card) {
    if (!active) return;
    if (card.kind === "action" && card.subtype === "jsn") return;
    e.preventDefault();
    pointerRef.current = { card, startX: e.clientX, startY: e.clientY };
  }

  // ── Targeting helpers ─────────────────────────────────────────────────────────

  function pickSlyTarget(card: PropertyCard) {
    if (!selected) return;
    dispatch({ type: "PlaySlyDeal", cardId: selected.id, targetPlayer: "ai", targetCardId: card.id });
    reset();
  }

  function pickForcedAiCard(card: PropertyCard) {
    setForcedAiCardId(card.id);
    setPickStep("forced-own-pick");
  }

  function pickForcedOwnCard(card: PropertyCard) {
    if (!selected || !forcedAiCardId) return;
    dispatch({ type: "PlayForcedDeal", cardId: selected.id, targetPlayer: "ai", targetCardId: forcedAiCardId, offeredCardId: card.id });
    reset();
  }

  function pickDealBreakerColor(color: PropertyColor) {
    if (!selected) return;
    dispatch({ type: "PlayDealBreaker", cardId: selected.id, targetPlayer: "ai", targetColor: color });
    reset();
  }

  function pickHouseColor(color: PropertyColor) {
    if (!selected) return;
    dispatch({ type: "PlayHouse", cardId: selected.id, targetColor: color });
    reset();
  }

  function pickHotelColor(color: PropertyColor) {
    if (!selected) return;
    dispatch({ type: "PlayHotel", cardId: selected.id, targetColor: color });
    reset();
  }

  function startRearrange() {
    setPickStep("rearrange-pick");
  }

  function pickRearrangeCard(card: PropertyCard) {
    setRearrangeCardId(card.id);
    setPickStep("rearrange-dest");
  }

  function pickRearrangeDest(color: PropertyColor) {
    if (!rearrangeCardId) return;
    dispatch({ type: "MoveProperty", cardId: rearrangeCardId, toColor: color });
    reset();
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const isRentColorPick = selected?.kind === "rent" && targetColor !== null;
  const isWildColorPick = selected?.kind === "property" && (selected.colors?.length ?? 1) > 1 && targetColor !== null;

  const aiNonCompleteProps: PropertyCard[] = (Object.entries(ai.sets) as [PropertyColor, PropertyCard[]][])
    .filter(([color]) => !isComplete(ai.sets, color))
    .flatMap(([, cards]) => cards);

  const aiCompleteColors = (Object.keys(ai.sets) as PropertyColor[])
    .filter(c => isComplete(ai.sets, c));

  const ownNonCompleteProps: PropertyCard[] = (Object.entries(player.sets) as [PropertyColor, PropertyCard[]][])
    .filter(([color]) => !isComplete(player.sets, color))
    .flatMap(([, cards]) => cards);

  const ownCompleteColors = (Object.keys(player.sets) as PropertyColor[])
    .filter(c => isComplete(player.sets, c) && !player.houses[c] && !player.hotels[c]);

  const ownHouseColors = (Object.keys(player.sets) as PropertyColor[])
    .filter(c => isComplete(player.sets, c) && player.houses[c] && !player.hotels[c]);

  // Wild cards in incomplete sets that can be rearranged
  const movableWildCards: PropertyCard[] = (Object.entries(player.sets) as [PropertyColor, PropertyCard[]][])
    .filter(([color]) => !isComplete(player.sets, color))
    .flatMap(([, cards]) => cards.filter(c => (c.colors?.length ?? 1) > 1));

  // Valid destination colors for the selected rearrange card
  const rearrangeCard = rearrangeCardId
    ? (Object.values(player.sets) as PropertyCard[][]).flat().find(c => c.id === rearrangeCardId)
    : null;
  const rearrangeDestColors: PropertyColor[] = rearrangeCard
    ? (rearrangeCard.colors ?? [rearrangeCard.color]).filter(col =>
        col !== rearrangeCard.color &&
        (player.sets[col]?.length ?? 0) < (SET_SIZES[col] ?? 99)
      )
    : [];

  // ── Discard mode ──────────────────────────────────────────────────────────────

  if (isDiscard) {
    return (
      <div style={{ flexShrink: 0, background: "rgba(20,5,5,0.95)", borderTop: "2px solid rgba(255,152,0,0.5)", backdropFilter: "blur(8px)" }}>
        <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#ffcc80", fontWeight: 800, fontSize: 13 }}>Discard {discardNeeded} card{discardNeeded !== 1 ? "s" : ""}</span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>({discardIds.length}/{discardNeeded} selected)</span>
          <button className="hud-btn dng" disabled={discardIds.length !== discardNeeded} onClick={confirmDiscard}>Discard selected</button>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 14px 12px", alignItems: "flex-end" }}>
          {player.hand.map(card => (
            <div key={card.id} onClick={() => toggleDiscard(card)} style={{ opacity: discardIds.includes(card.id) ? 1 : 0.7 }}>
              <CardFace card={card} width={82} selected={discardIds.includes(card.id)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Normal play mode ──────────────────────────────────────────────────────────

  return (
    <>
      {/* Drop zone overlay — visible while dragging */}
      {ghostCard && (
        <div style={{
          position: "fixed", inset: 0,
          bottom: handRef.current ? window.innerHeight - (handRef.current.getBoundingClientRect().top - 30) : 120,
          display: "flex",
          zIndex: 90,
          pointerEvents: "none",
        }}>
          {/* Play zone */}
          <div style={{
            flex: "0 0 65%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: dropZone === "play" ? "rgba(67,160,71,0.32)" : "rgba(67,160,71,0.1)",
            border: `2px dashed ${dropZone === "play" ? "#66bb6a" : "rgba(102,187,106,0.35)"}`,
            borderRadius: 16,
            margin: 12,
            transition: "background 0.15s, border-color 0.15s",
            gap: 8,
          }}>
            <span style={{ fontSize: 32 }}>▶</span>
            <span style={{ color: dropZone === "play" ? "#a5d6a7" : "rgba(255,255,255,0.5)", fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>PLAY</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Property · Action · Rent</span>
          </div>
          {/* Bank zone */}
          <div style={{
            flex: "0 0 35%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: dropZone === "bank" ? "rgba(255,215,64,0.28)" : "rgba(255,215,64,0.07)",
            border: `2px dashed ${dropZone === "bank" ? "#ffd740" : "rgba(255,215,64,0.3)"}`,
            borderRadius: 16,
            margin: "12px 12px 12px 0",
            transition: "background 0.15s, border-color 0.15s",
            gap: 8,
          }}>
            <span style={{ fontSize: 28 }}>💵</span>
            <span style={{ color: dropZone === "bank" ? "#ffd740" : "rgba(255,255,255,0.5)", fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>BANK</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Any card</span>
          </div>
        </div>
      )}

      {/* Ghost card following cursor */}
      {ghostCard && (
        <div style={{
          position: "fixed",
          left: ghostCard.x - 35,
          top: ghostCard.y - 50,
          pointerEvents: "none",
          zIndex: 200,
          transform: "rotate(6deg) scale(1.12)",
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
          opacity: 0.92,
        }}>
          <CardFace card={ghostCard.card} width={82} />
        </div>
      )}

      <div ref={handRef} style={{ flexShrink: 0, background: "rgba(5,20,8,0.92)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>

        {/* Targeting overlays */}
        {pickStep === "sly-target"     && <PropertyPicker cards={aiNonCompleteProps}  onPick={pickSlyTarget}      label="Pick opponent's property to steal:" onCancel={reset} />}
        {pickStep === "forced-ai-pick" && <PropertyPicker cards={aiNonCompleteProps}  onPick={pickForcedAiCard}   label="Pick opponent's property to take:" onCancel={reset} />}
        {pickStep === "forced-own-pick"&& <PropertyPicker cards={ownNonCompleteProps} onPick={pickForcedOwnCard}  label="Pick your property to give in exchange:" onCancel={reset} />}
        {pickStep === "dealbreaker-pick"&&<ColorPicker    colors={aiCompleteColors}   onPick={pickDealBreakerColor} label="Pick opponent's complete set to steal:" onCancel={reset} />}
        {pickStep === "house-pick"     && <ColorPicker    colors={ownCompleteColors}  onPick={pickHouseColor}     label="Add house to which set?" onCancel={reset} />}
        {pickStep === "hotel-pick"     && <ColorPicker    colors={ownHouseColors}     onPick={pickHotelColor}     label="Add hotel to which set?" onCancel={reset} />}
        {pickStep === "rearrange-pick" && <PropertyPicker cards={movableWildCards}    onPick={pickRearrangeCard}  label="Pick your wild card to move:" onCancel={reset} />}
        {pickStep === "rearrange-dest" && <ColorPicker    colors={rearrangeDestColors} onPick={pickRearrangeDest} label="Move to which colour set?" onCancel={reset} />}

        {/* Standard action bar */}
        {selected && active && !pickStep && (
          <div style={{ padding: "8px 14px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {isRentColorPick ? (
              <>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Pick color to charge:</span>
                {(selected.kind === "rent" ? selected.colors : []).map(col => (
                  <button key={col} className="hud-btn pri" style={{ textTransform: "capitalize" }} onClick={() => playRent(col)}>{col}</button>
                ))}
              </>
            ) : isWildColorPick ? (
              <>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Place in which set?</span>
                {(selected.kind === "property" ? (selected.colors ?? [selected.color]) : []).map(col => (
                  <button key={col} className="hud-btn pri"
                    style={{ textTransform: "capitalize", background: PROP_COLOR[col], color: col === "yellow" ? "#212121" : "#fff" }}
                    onClick={() => { dispatch({ type: "PlayProperty", cardId: selected.id, toColor: col }); reset(); }}>
                    {col}
                  </button>
                ))}
              </>
            ) : (
              <>
                {selected.kind !== "property" && (
                  <button className="hud-btn suc" onClick={() => { dispatch({ type: "BankCard", cardId: selected.id }); reset(); }}>
                    Bank ${selected.value}M
                  </button>
                )}
                {selected.kind === "property" && (
                  <button className="hud-btn pri" onClick={playProperty}>▶ Play to board</button>
                )}
                {selected.kind === "action" && selected.subtype !== "jsn" && (
                  <button className="hud-btn pri" onClick={playAction}>▶ Play action</button>
                )}
                {selected.kind === "rent" && (
                  <button className="hud-btn pri" onClick={startRent}>▶ Charge rent</button>
                )}
              </>
            )}
            <button className="hud-btn sec" onClick={reset}>✕ Cancel</button>
          </div>
        )}

        {/* Rearrange button — shown when player has moveable wild cards and nothing selected */}
        {active && !selected && !pickStep && movableWildCards.length > 0 && (
          <div style={{ padding: "6px 14px 0" }}>
            <button className="hud-btn sec" onClick={startRearrange} style={{ fontSize: 11, padding: "5px 12px" }}>
              ⇄ Rearrange wild cards
            </button>
          </div>
        )}

        {/* Hint when dragging is possible */}
        {active && !selected && !pickStep && !ghostCard && (
          <div style={{ padding: "6px 14px 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Tap to select · Drag up to play or bank
          </div>
        )}

        {/* Hand */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 16px 16px", alignItems: "flex-end" }}>
          {player.hand.map(card => {
            const isJsn = card.kind === "action" && card.subtype === "jsn";
            return (
              <div
                key={card.id}
                onPointerDown={e => onCardPointerDown(e, card)}
                style={{
                  opacity: (!active || isJsn) ? 0.5 : 1,
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                <CardFace card={card} width={82} selected={selected?.id === card.id} />
              </div>
            );
          })}
          {player.hand.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, padding: "8px 0" }}>
              No cards — draw to start your turn
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Picker sub-components (defined outside PlayerHand to keep stable identity) ──

function PropertyPicker({ cards, onPick, label, onCancel }: {
  cards: PropertyCard[];
  onPick: (c: PropertyCard) => void;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div style={{ padding: "8px 14px 0" }}>
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginRight: 8 }}>{label}</span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        {cards.map(c => (
          <div
            key={c.id}
            onPointerDown={e => { e.stopPropagation(); onPick(c); }}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <CardFace card={c} width={52} />
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "capitalize",
              background: PROP_COLOR[c.color],
              color: c.color === "yellow" ? "#212121" : "#fff",
              padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
            }}>{c.color}</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", textAlign: "center", maxWidth: 58 }}>{c.name}</span>
          </div>
        ))}
        {cards.length === 0 && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>No valid targets</span>}
      </div>
      <button className="hud-btn sec" style={{ marginTop: 8 }} onPointerDown={e => { e.stopPropagation(); onCancel(); }}>✕ Cancel</button>
    </div>
  );
}

function ColorPicker({ colors, onPick, label, onCancel }: {
  colors: PropertyColor[];
  onPick: (c: PropertyColor) => void;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div style={{ padding: "8px 14px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{label}</span>
      {colors.map(col => (
        <button key={col} className="hud-btn pri"
          onPointerDown={e => { e.stopPropagation(); onPick(col); }}
          style={{ textTransform: "capitalize", background: PROP_COLOR[col], color: col === "yellow" ? "#212121" : "#fff" }}>
          {col}
        </button>
      ))}
      {colors.length === 0 && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>No valid targets</span>}
      <button className="hud-btn sec" onPointerDown={e => { e.stopPropagation(); onCancel(); }}>✕ Cancel</button>
    </div>
  );
}
