import type { Card, BankableCard, PropertyCard, PropertyColor } from "./card.types";

export type PlayerId = "player" | "ai";
export type Difficulty = "easy" | "medium" | "hard";

export type PropertySets = Partial<Record<PropertyColor, PropertyCard[]>>;

export type GamePhase =
  | "idle"
  | "draw"
  | "action"
  | "reaction"
  | "discard"
  | "over";

export type PendingReaction =
  | {
      readonly kind: "jsnCheck";
      /** the player who can play JSN (or accept) */
      readonly reactingPlayer: PlayerId;
      /** seq of the ActionInitiated event being contested */
      readonly triggerSeq: number;
      /** 0 = original target can JSN, 1 = initiator can counter-JSN, etc. */
      readonly jsnChain: number;
      // Action context — what is actually being played
      readonly actionKind: "rent" | "slydeal" | "forceddeal" | "dealbreaker" | "debtcollector" | "birthday";
      readonly color?: PropertyColor;      // rent / dealbreaker
      readonly baseAmount?: number;        // rent amount pre-double
      readonly doubled: boolean;
      readonly targetCardId?: string;      // slydeal / forceddeal: card being taken
      readonly offeredCardId?: string;     // forceddeal: card offered in return
    }
  | {
      readonly kind: "payDebt";
      readonly creditor: PlayerId;
      readonly debtor: PlayerId;
      readonly amountOwed: number;
      readonly triggerSeq: number;
    }
  | {
      readonly kind: "forcedDealGive";
      readonly giver: PlayerId;
      readonly receiver: PlayerId;
      readonly receiverCard: PropertyCard;
      readonly triggerSeq: number;
    };

export interface PlayerZone {
  readonly id: PlayerId;
  hand: Card[];
  bank: BankableCard[];
  sets: PropertySets;
  houses: Partial<Record<PropertyColor, true>>;
  hotels: Partial<Record<PropertyColor, true>>;
}

export interface TurnState {
  readonly activePlayer: PlayerId;
  playsLeft: number;
  hasDrawn: boolean;
  doubleRentPending: boolean;
}

export interface GameState {
  readonly gameId: string;
  phase: GamePhase;
  turn: TurnState;
  players: Record<PlayerId, PlayerZone>;
  deckSize: number;
  discardPile: Card[];
  pendingReaction: PendingReaction | null;
  winner: PlayerId | null;
  difficulty: Difficulty;
  version: number;
}
