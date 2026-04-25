import type { ActionCard, Card, PropertyColor, RentCard, TablePropertyCard } from "./cards";

export type PlayerId = string;

export interface PlayerConfig {
  id: PlayerId;
  name: string;
  role: "human" | "bot";
  botStrategyId?: string;
}

export interface LocatedProperty {
  card: TablePropertyCard;
  color: PropertyColor;
}

export interface LocatedImprovement {
  card: ActionCard;
  color: PropertyColor;
}

export interface PaymentAsset {
  card: Card;
  source: "bank" | "property";
  color?: PropertyColor;
}

export interface GameStartedEvent {
  type: "GameStarted";
  gameId: string;
  seed: string;
  players: PlayerConfig[];
  startingPlayerId: PlayerId;
  hands: Record<PlayerId, Card[]>;
  deck: Card[];
}

export interface CardsDrawnEvent {
  type: "CardsDrawn";
  playerId: PlayerId;
  cards: Card[];
}

export interface DiscardPileRecycledEvent {
  type: "DiscardPileRecycled";
  cards: Card[];
}

export interface CardBankedEvent {
  type: "CardBanked";
  playerId: PlayerId;
  card: Card;
}

export interface PropertyPlayedEvent {
  type: "PropertyPlayed";
  playerId: PlayerId;
  card: TablePropertyCard;
  color: PropertyColor;
}

export interface ImprovementBuiltEvent {
  type: "ImprovementBuilt";
  playerId: PlayerId;
  card: ActionCard;
  color: PropertyColor;
}

export interface ActionResolvedEvent {
  type: "ActionResolved";
  playerId: PlayerId;
  card: ActionCard;
  action: ActionCard["action"];
}

export interface RentChargedEvent {
  type: "RentCharged";
  playerId: PlayerId;
  targetPlayerIds: PlayerId[];
  card: RentCard;
  color: PropertyColor;
  amount: number;
  doubled: boolean;
  doubleRentCard?: ActionCard;
}

export interface JustSayNoPlayedEvent {
  type: "JustSayNoPlayed";
  playerId: PlayerId;
  againstPlayerId: PlayerId;
  card: ActionCard;
  againstCard: ActionCard | RentCard;
}

export interface PaymentCollectedEvent {
  type: "PaymentCollected";
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  requestedAmount: number;
  paidAmount: number;
  assets: PaymentAsset[];
}

export interface PropertyStolenEvent {
  type: "PropertyStolen";
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  property: LocatedProperty;
  reason: "slyDeal" | "payment";
}

export interface CompleteSetStolenEvent {
  type: "CompleteSetStolen";
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  color: PropertyColor;
  properties: TablePropertyCard[];
  improvements: ActionCard[];
}

export interface PropertiesSwappedEvent {
  type: "PropertiesSwapped";
  playerId: PlayerId;
  targetPlayerId: PlayerId;
  offered: LocatedProperty;
  received: LocatedProperty;
}

export interface CardsDiscardedEvent {
  type: "CardsDiscarded";
  playerId: PlayerId;
  cards: Card[];
}

export interface TurnEndedEvent {
  type: "TurnEnded";
  playerId: PlayerId;
}

export interface TurnStartedEvent {
  type: "TurnStarted";
  playerId: PlayerId;
}

export interface GameWonEvent {
  type: "GameWon";
  playerId: PlayerId;
  completedSets: number;
}

export type DomainEvent =
  | GameStartedEvent
  | DiscardPileRecycledEvent
  | CardsDrawnEvent
  | CardBankedEvent
  | PropertyPlayedEvent
  | ImprovementBuiltEvent
  | ActionResolvedEvent
  | JustSayNoPlayedEvent
  | RentChargedEvent
  | PaymentCollectedEvent
  | PropertyStolenEvent
  | CompleteSetStolenEvent
  | PropertiesSwappedEvent
  | CardsDiscardedEvent
  | TurnEndedEvent
  | TurnStartedEvent
  | GameWonEvent;
