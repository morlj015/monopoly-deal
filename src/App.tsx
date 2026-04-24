import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  FastForward,
  Gift,
  HandCoins,
  Landmark,
  Play,
  RefreshCw,
  Trash2,
  Users,
  X
} from "lucide-react";
import { useGameSession } from "./application/useGameSession";
import { HUMAN_PLAYER_ID } from "./application/session";
import { IndexedDbEventStore } from "./infrastructure/indexedDbEventStore";
import {
  buildImprovement,
  discardCards,
  drawAtTurnStart,
  endTurn,
  playBirthday,
  playCardToBank,
  playDealBreaker,
  playDebtCollector,
  playForcedDeal,
  playPassGo,
  playProperty,
  playRent,
  playSlyDeal
} from "./domain/commands";
import { playableRentColors, type BotDifficulty } from "./domain/bot";
import {
  isActionCard,
  isBankableCard,
  isImprovementAction,
  isPropertyCard,
  isPropertyWildCard,
  isRentCard,
  isTablePropertyCard,
  PROPERTY_COLORS,
  PROPERTY_CONFIG,
  type Card,
  type PropertyColor
} from "./domain/cards";
import {
  bankValue,
  completedSetColors,
  HAND_LIMIT,
  isCompleteSet,
  propertyValue,
  rentFor,
  type GameState,
  type PlayerState
} from "./domain/state";
import { ThreeTable } from "./ui/ThreeTable";

type Icon = typeof Play;

const difficultyOptions: BotDifficulty[] = ["easy", "medium", "hard"];

const money = (value: number) => `$${value}M`;

const cardLabel = (card: Card): string => {
  if (isPropertyCard(card)) {
    return PROPERTY_CONFIG[card.color].label;
  }
  if (isPropertyWildCard(card)) {
    return card.anyColor
      ? "Wild Property"
      : card.colors.map((color) => PROPERTY_CONFIG[color].label).join(" / ");
  }
  if (isRentCard(card)) {
    return card.anyColor ? "Any color" : card.colors.map((color) => PROPERTY_CONFIG[color].label).join(" / ");
  }
  if (isActionCard(card)) {
    return card.action === "justSayNo" ? "Defense" : "Action";
  }
  return "Money";
};

const cardStyle = (card: Card) => {
  if (isPropertyCard(card)) {
    return {
      "--card-accent": PROPERTY_CONFIG[card.color].hex,
      "--card-text": PROPERTY_CONFIG[card.color].text
    } as React.CSSProperties;
  }
  if (isPropertyWildCard(card)) {
    const color = card.colors[0] ?? "railroad";
    return {
      "--card-accent": card.anyColor ? "#ffffff" : PROPERTY_CONFIG[color].hex,
      "--card-text": "#111923"
    } as React.CSSProperties;
  }
  if (isRentCard(card)) {
    return { "--card-accent": "#f0c344", "--card-text": "#211b08" } as React.CSSProperties;
  }
  if (isActionCard(card)) {
    return { "--card-accent": "#57a0d8", "--card-text": "#061321" } as React.CSSProperties;
  }
  return { "--card-accent": "#6fbf73", "--card-text": "#07160a" } as React.CSSProperties;
};

interface CommandButtonProps {
  icon: Icon;
  children: string;
  disabled?: boolean;
  variant?: "primary" | "quiet" | "danger";
  onClick: () => void;
}

const CommandButton = ({
  icon: IconComponent,
  children,
  disabled,
  variant = "quiet",
  onClick
}: CommandButtonProps) => (
  <button className={`command-button ${variant}`} disabled={disabled} onClick={onClick}>
    <IconComponent size={16} strokeWidth={2.2} />
    <span>{children}</span>
  </button>
);

interface PlayingCardProps {
  card?: Card;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  facedown?: boolean;
  onClick?: () => void;
}

const PlayingCard = ({
  card,
  selected = false,
  disabled = false,
  compact = false,
  facedown = false,
  onClick
}: PlayingCardProps) => {
  if (facedown || !card) {
    return <div className={`playing-card facedown ${compact ? "compact" : ""}`} />;
  }

  return (
    <button
      className={`playing-card ${card.kind} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      style={cardStyle(card)}
      disabled={disabled}
      onClick={onClick}
      title={`${card.name} ${money(card.value)}`}
    >
      <span className="card-band">{cardLabel(card)}</span>
      <span className="card-name">{card.name}</span>
      <span className="card-value">{money(card.value)}</span>
    </button>
  );
};

const BankStrip = ({ player }: { player?: PlayerState }) => (
  <div className="bank-strip">
    {player && player.bank.length > 0 ? (
      player.bank.map((card) => <PlayingCard key={card.id} card={card} compact disabled />)
    ) : (
      <span className="empty-copy">No bank</span>
    )}
  </div>
);

const SetStack = ({
  player,
  color
}: {
  player: PlayerState;
  color: PropertyColor;
}) => {
  const stack = player.sets[color];
  const complete = isCompleteSet(stack, color);
  if (stack.properties.length === 0 && stack.improvements.length === 0) {
    return null;
  }

  return (
    <section className={`property-stack ${complete ? "complete" : ""}`}>
      <header>
        <span className="set-dot" style={{ background: PROPERTY_CONFIG[color].hex }} />
        <span>{PROPERTY_CONFIG[color].label}</span>
        <strong>
          {stack.properties.length}/{PROPERTY_CONFIG[color].setSize}
        </strong>
      </header>
      <div className="stack-cards">
        {stack.properties.map((card) => (
          <PlayingCard key={card.id} card={card} compact disabled />
        ))}
        {stack.improvements.map((card) => (
          <PlayingCard key={card.id} card={card} compact disabled />
        ))}
      </div>
      <footer>{money(rentFor(player, color))} rent</footer>
    </section>
  );
};

const PropertyGrid = ({ player }: { player?: PlayerState }) => {
  if (!player) {
    return null;
  }
  return (
    <div className="property-grid">
      {PROPERTY_COLORS.map((color) => (
        <SetStack key={color} player={player} color={color} />
      ))}
    </div>
  );
};

const PlayerSummary = ({
  label,
  player,
  active
}: {
  label: string;
  player?: PlayerState;
  active: boolean;
}) => (
  <section className={`player-summary ${active ? "active" : ""}`}>
    <div>
      <span className="summary-label">{label}</span>
      <strong>{player?.name ?? "Waiting"}</strong>
    </div>
    <div className="summary-stats">
      <span>{player?.hand.length ?? 0} hand</span>
      <span>{money(player ? bankValue(player) : 0)} bank</span>
      <span>{player ? completedSetColors(player).length : 0}/3 sets</span>
    </div>
  </section>
);

const eligibleSlyDealTargets = (player?: PlayerState) => {
  if (!player) {
    return [];
  }
  return PROPERTY_COLORS.flatMap((color) =>
    isCompleteSet(player.sets[color], color)
      ? []
      : player.sets[color].properties.map((card) => ({ card, color }))
  );
};

const allProperties = (player?: PlayerState) => {
  if (!player) {
    return [];
  }
  return PROPERTY_COLORS.flatMap((color) =>
    player.sets[color].properties.map((card) => ({ card, color }))
  );
};

const buildableColors = (state: GameState, playerId: string, card: Card | undefined) => {
  if (!card || !isImprovementAction(card)) {
    return [];
  }
  const player = state.players[playerId];
  if (!player) {
    return [];
  }
  return PROPERTY_COLORS.filter((color) => {
    const stack = player.sets[color];
    if (!PROPERTY_CONFIG[color].canImprove || !isCompleteSet(stack, color)) {
      return false;
    }
    if (card.action === "house") {
      return !stack.improvements.some((improvement) => improvement.action === "house");
    }
    return (
      stack.improvements.some((improvement) => improvement.action === "house") &&
      !stack.improvements.some((improvement) => improvement.action === "hotel")
    );
  });
};

export const App = () => {
  const eventStore = useMemo(() => new IndexedDbEventStore(), []);
  const {
    state,
    difficulty,
    setDifficulty,
    loading,
    busy,
    error,
    clearError,
    dispatch,
    runBotStep,
    startNewGame,
    startBotGame
  } = useGameSession(eventStore);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [discardIds, setDiscardIds] = useState<string[]>([]);
  const [doubleRent, setDoubleRent] = useState(false);
  const [forcedOwnId, setForcedOwnId] = useState<string | null>(null);
  const [forcedTargetId, setForcedTargetId] = useState<string | null>(null);
  const [botDelay, setBotDelay] = useState(250);

  const players = state.playerOrder.map((playerId) => state.players[playerId]).filter(Boolean);
  const human = players.find((player) => player.role === "human");
  const focusPlayer = human ?? (state.currentTurn ? state.players[state.currentTurn] : players[0]);
  const opponents = players.filter((player) => player.id !== focusPlayer?.id);
  const primaryTarget = opponents[0];
  const isHumanTurn = Boolean(human && state.currentTurn === human.id && state.status === "active");
  const isBotTurn = Boolean(
    state.currentTurn && state.players[state.currentTurn]?.role === "bot" && state.status === "active"
  );
  const isSelfPlay = players.length > 0 && !human;
  const selectedCard = human?.hand.find((card) => card.id === selectedCardId);
  const canAct = Boolean(isHumanTurn && !state.mustDraw && !busy);
  const overLimit = Math.max(0, (human?.hand.length ?? 0) - HAND_LIMIT);
  const discarding = overLimit > 0 && isHumanTurn && !state.mustDraw;
  const targetCompleteSets = primaryTarget ? completedSetColors(primaryTarget) : [];
  const slyTargets = eligibleSlyDealTargets(primaryTarget);
  const ownProperties = allProperties(human);
  const forcedTargets = eligibleSlyDealTargets(primaryTarget);
  const selectedDoubleRentCard = human?.hand.find(
    (card) => isActionCard(card) && card.action === "doubleRent" && card.id !== selectedCardId
  );
  const rentColors =
    selectedCard && human && isRentCard(selectedCard)
      ? playableRentColors(state, human.id, selectedCard.id)
      : [];
  const wildPropertyColors = selectedCard && isPropertyWildCard(selectedCard) ? selectedCard.colors : [];

  useEffect(() => {
    if (!selectedCardId || human?.hand.some((card) => card.id === selectedCardId)) {
      return;
    }
    setSelectedCardId(null);
  }, [human?.hand, selectedCardId]);

  useEffect(() => {
    setDoubleRent(false);
    setForcedOwnId(null);
    setForcedTargetId(null);
  }, [selectedCardId]);

  useEffect(() => {
    if (!loading && !busy && isBotTurn) {
      const timer = window.setTimeout(() => {
        void runBotStep();
      }, state.mustDraw ? Math.max(120, botDelay / 2) : botDelay);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [botDelay, busy, isBotTurn, loading, runBotStep, state.mustDraw, state.version]);

  const afterCommand = (ok: boolean) => {
    if (ok) {
      setSelectedCardId(null);
      setDiscardIds([]);
    }
  };

  const selectCard = (cardId: string) => {
    if (discarding) {
      setDiscardIds((current) =>
        current.includes(cardId)
          ? current.filter((id) => id !== cardId)
          : current.length < overLimit
            ? [...current, cardId]
            : current
      );
      return;
    }
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  };

  const playSelectedToBank = async () => {
    if (!selectedCard || !human) {
      return;
    }
    afterCommand(await dispatch((current) => playCardToBank(current, human.id, selectedCard.id)));
  };

  const playSelectedProperty = async (color?: PropertyColor) => {
    if (!selectedCard || !human) {
      return;
    }
    afterCommand(await dispatch((current) => playProperty(current, human.id, selectedCard.id, color)));
  };

  const resolveSelectedAction = async () => {
    if (!selectedCard || !human || !isActionCard(selectedCard)) {
      return;
    }
    const cardId = selectedCard.id;
    const ok = await dispatch((current) => {
      if (selectedCard.action === "passGo") {
        return playPassGo(current, human.id, cardId);
      }
      if (selectedCard.action === "debtCollector") {
        if (!primaryTarget) {
          return [];
        }
        return playDebtCollector(current, human.id, cardId, primaryTarget.id);
      }
      if (selectedCard.action === "birthday") {
        return playBirthday(current, human.id, cardId);
      }
      return playCardToBank(current, human.id, cardId);
    });
    afterCommand(ok);
  };

  const selectedActionName = selectedCard && isActionCard(selectedCard) ? selectedCard.action : null;
  const canResolveSimpleAction =
    selectedActionName === "passGo" ||
    selectedActionName === "debtCollector" ||
    selectedActionName === "birthday";

  const confirmDiscard = async () => {
    if (!human) {
      return;
    }
    afterCommand(await dispatch((current) => discardCards(current, human.id, discardIds)));
  };

  return (
    <main className="app-shell">
      <ThreeTable state={state} />
      <section className="game-surface">
        <header className="top-bar">
          <div className="brand-lockup">
            <span className="brand-mark">MD</span>
            <div>
              <h1>Monopoly Deal</h1>
              <p>
                {state.status === "won"
                  ? "Game complete"
                  : isSelfPlay
                    ? "Bot self-play"
                    : isHumanTurn
                      ? "Your turn"
                      : "Dealer turn"}
              </p>
            </div>
          </div>
          <div className="top-actions">
            <div className="difficulty-tabs" role="tablist" aria-label="Difficulty">
              {difficultyOptions.map((option) => (
                <button
                  key={option}
                  className={option === difficulty ? "active" : ""}
                  onClick={() => setDifficulty(option)}
                  disabled={busy || isBotTurn}
                >
                  {option}
                </button>
              ))}
            </div>
            <CommandButton
              icon={RefreshCw}
              variant="primary"
              disabled={busy}
              onClick={() => void startNewGame(difficulty)}
            >
              New Deal
            </CommandButton>
            <CommandButton
              icon={Users}
              disabled={busy}
              onClick={() => void startBotGame(4, difficulty)}
            >
              Bot Table
            </CommandButton>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={clearError} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="score-row">
          {players.map((player) => (
            <PlayerSummary
              key={player.id}
              label={player.role === "human" ? "Player" : "Bot"}
              player={player}
              active={state.currentTurn === player.id}
            />
          ))}
          <div className="deck-meter">
            <strong>{state.deck.length}</strong>
            <span>deck</span>
          </div>
        </section>

        <section className="table-grid">
          <section className="zone opponent-zone">
            <header className="zone-header">
              <h2>{isSelfPlay ? "Opponents" : primaryTarget?.name ?? "Dealer"}</h2>
              <span>{opponents.length} seated</span>
            </header>
            <div className="opponent-list">
              {opponents.map((player) => (
                <section key={player.id} className={`opponent-card ${state.currentTurn === player.id ? "active" : ""}`}>
                  <header>
                    <strong>{player.name}</strong>
                    <span>{money(bankValue(player) + propertyValue(player))} exposed</span>
                  </header>
                  <div className="facedown-row">
                    {Array.from({ length: Math.min(player.hand.length, 9) }).map((_, index) => (
                      <PlayingCard key={index} facedown compact />
                    ))}
                  </div>
                  <BankStrip player={player} />
                  <PropertyGrid player={player} />
                </section>
              ))}
            </div>
          </section>

          <aside className="side-panel">
            <section className="turn-card">
              <div className="plays">
                {Array.from({ length: 3 }).map((_, index) => (
                  <span key={index} className={index < state.playsRemaining ? "available" : ""} />
                ))}
              </div>
              <strong>
                {loading
                  ? "Loading"
                  : state.status === "won"
                    ? `${state.players[state.winner ?? ""]?.name ?? "Someone"} wins`
                    : isHumanTurn
                      ? "Your move"
                      : `${state.currentTurn ? state.players[state.currentTurn]?.name : "Dealer"} thinking`}
              </strong>
              <p>{state.mustDraw && isHumanTurn ? "Draw phase" : `${state.playsRemaining} plays left`}</p>
              <label className="speed-control">
                <span>Bot speed</span>
                <input
                  type="range"
                  min="80"
                  max="900"
                  step="10"
                  value={botDelay}
                  onChange={(event) => setBotDelay(Number(event.target.value))}
                />
              </label>
              {human && (
                <div className="control-stack">
                  <CommandButton
                    icon={HandCoins}
                    variant="primary"
                    disabled={!isHumanTurn || !state.mustDraw || busy}
                    onClick={() => void dispatch((current) => drawAtTurnStart(current, human.id))}
                  >
                    Draw Two
                  </CommandButton>
                  <CommandButton
                    icon={FastForward}
                    disabled={!isHumanTurn || state.mustDraw || overLimit > 0 || busy}
                    onClick={() => void dispatch((current) => endTurn(current, human.id))}
                  >
                    End Turn
                  </CommandButton>
                </div>
              )}
            </section>

            <section className="log-card">
              <h2>Log</h2>
              <ol>
                {state.log.slice(0, 8).map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
            </section>
          </aside>

          <section className="zone player-zone">
            <header className="zone-header">
              <h2>{focusPlayer?.name ?? "You"}</h2>
              <span>
                {focusPlayer ? `${completedSetColors(focusPlayer).length}/3 complete sets` : "0/3 complete sets"}
              </span>
            </header>
            <BankStrip player={focusPlayer} />
            <PropertyGrid player={focusPlayer} />

            {discarding && (
              <section className="action-panel danger-panel">
                <div>
                  <strong>Discard {overLimit}</strong>
                  <span>{discardIds.length}/{overLimit} selected</span>
                </div>
                <CommandButton
                  icon={Trash2}
                  variant="danger"
                  disabled={discardIds.length !== overLimit || busy}
                  onClick={() => void confirmDiscard()}
                >
                  Discard
                </CommandButton>
              </section>
            )}

            {selectedCard && !discarding && (
              <section className="action-panel">
                <div className="selected-copy">
                  <strong>{selectedCard.name}</strong>
                  <span>{cardLabel(selectedCard)} · {money(selectedCard.value)}</span>
                </div>
                <div className="command-row">
                  {isBankableCard(selectedCard) && (
                    <CommandButton
                      icon={Archive}
                      disabled={!canAct}
                      onClick={() => void playSelectedToBank()}
                    >
                      Bank
                    </CommandButton>
                  )}
                  {isPropertyCard(selectedCard) && (
                    <CommandButton
                      icon={Landmark}
                      variant="primary"
                      disabled={!canAct}
                      onClick={() => void playSelectedProperty(selectedCard.color)}
                    >
                      Play Property
                    </CommandButton>
                  )}
                  {canResolveSimpleAction && (
                    <CommandButton
                      icon={selectedActionName === "birthday" ? Gift : Play}
                      variant="primary"
                      disabled={!canAct}
                      onClick={() => void resolveSelectedAction()}
                    >
                      Resolve
                    </CommandButton>
                  )}
                </div>

                {isPropertyWildCard(selectedCard) && wildPropertyColors.length > 0 && (
                  <div className="choice-grid">
                    {wildPropertyColors.map((color) => (
                      <button
                        key={color}
                        className="color-choice"
                        style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                        disabled={!canAct}
                        onClick={() => void playSelectedProperty(color)}
                      >
                        {PROPERTY_CONFIG[color].label}
                        <strong>Play wild</strong>
                      </button>
                    ))}
                  </div>
                )}

                {isRentCard(selectedCard) && rentColors.length > 0 && (
                  <div className="choice-block">
                    <label className="toggle-line">
                      <input
                        type="checkbox"
                        checked={doubleRent}
                        disabled={!selectedDoubleRentCard || state.playsRemaining < 2}
                        onChange={(event) => setDoubleRent(event.target.checked)}
                      />
                      <span>Double rent</span>
                    </label>
                    <div className="choice-grid">
                      {rentColors.map((color) => (
                        <button
                          key={color}
                          className="color-choice"
                          style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                          disabled={!canAct}
                          onClick={() =>
                            void dispatch((current) =>
                              playRent(
                                current,
                                human?.id ?? HUMAN_PLAYER_ID,
                                selectedCard.id,
                                selectedCard.scope === "all" ? null : primaryTarget?.id ?? null,
                                color,
                                doubleRent ? selectedDoubleRentCard?.id : undefined
                              )
                            ).then(afterCommand)
                          }
                        >
                          {PROPERTY_CONFIG[color].label}
                          <strong>{money(human ? rentFor(human, color, doubleRent) : 0)}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isActionCard(selectedCard) && selectedCard.action === "dealBreaker" && (
                  <div className="choice-grid">
                    {targetCompleteSets.map((color) => (
                      <button
                        key={color}
                        className="color-choice"
                        style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                        disabled={!canAct}
                        onClick={() =>
                          void dispatch((current) =>
                            playDealBreaker(
                              current,
                              human?.id ?? HUMAN_PLAYER_ID,
                              selectedCard.id,
                              primaryTarget?.id ?? "",
                              color
                            )
                          ).then(afterCommand)
                        }
                      >
                        {PROPERTY_CONFIG[color].label}
                        <strong>Steal set</strong>
                      </button>
                    ))}
                  </div>
                )}

                {isActionCard(selectedCard) && selectedCard.action === "slyDeal" && (
                  <div className="choice-grid">
                    {slyTargets.map(({ card, color }) => (
                      <button
                        key={card.id}
                        className="color-choice"
                        style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                        disabled={!canAct}
                        onClick={() =>
                          void dispatch((current) =>
                            playSlyDeal(
                              current,
                              human?.id ?? HUMAN_PLAYER_ID,
                              selectedCard.id,
                              primaryTarget?.id ?? "",
                              card.id
                            )
                          ).then(afterCommand)
                        }
                      >
                        {card.name}
                        <strong>Sly Deal</strong>
                      </button>
                    ))}
                  </div>
                )}

                {isActionCard(selectedCard) && selectedCard.action === "forcedDeal" && (
                  <div className="swap-grid">
                    <div>
                      <span className="mini-label">Give</span>
                      {ownProperties.map(({ card, color }) => (
                        <button
                          key={card.id}
                          className={forcedOwnId === card.id ? "selected" : ""}
                          style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                          onClick={() => setForcedOwnId(card.id)}
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                    <div>
                      <span className="mini-label">Take</span>
                      {forcedTargets.map(({ card, color }) => (
                        <button
                          key={card.id}
                          className={forcedTargetId === card.id ? "selected" : ""}
                          style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                          onClick={() => setForcedTargetId(card.id)}
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                    <CommandButton
                      icon={ArrowRightLeft}
                      variant="primary"
                      disabled={!canAct || !forcedOwnId || !forcedTargetId}
                      onClick={() =>
                        void dispatch((current) =>
                          playForcedDeal(
                            current,
                            human?.id ?? HUMAN_PLAYER_ID,
                            selectedCard.id,
                            primaryTarget?.id ?? "",
                            forcedOwnId ?? "",
                            forcedTargetId ?? ""
                          )
                        ).then(afterCommand)
                      }
                    >
                      Swap
                    </CommandButton>
                  </div>
                )}

                {isImprovementAction(selectedCard) && (
                  <div className="choice-grid">
                    {buildableColors(state, human?.id ?? HUMAN_PLAYER_ID, selectedCard).map((color) => (
                      <button
                        key={color}
                        className="color-choice"
                        style={{ "--choice": PROPERTY_CONFIG[color].hex } as React.CSSProperties}
                        disabled={!canAct}
	                        onClick={() =>
	                          void dispatch((current) =>
	                            buildImprovement(current, human?.id ?? HUMAN_PLAYER_ID, selectedCard.id, color)
	                          ).then(afterCommand)
	                        }
                      >
                        {PROPERTY_CONFIG[color].label}
                        <strong>{selectedCard.action === "house" ? "House" : "Hotel"}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="hand-row" aria-label="Player hand">
              {(human?.hand ?? focusPlayer?.hand ?? []).map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  selected={
                    discarding ? discardIds.includes(card.id) : selectedCardId === card.id
                  }
                  disabled={!human || !isHumanTurn || state.mustDraw || busy}
                  onClick={human ? () => selectCard(card.id) : undefined}
                />
              ))}
            </section>
          </section>
        </section>
      </section>
    </main>
  );
};
