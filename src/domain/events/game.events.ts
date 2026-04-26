import type { Card, PropertyCard, BankableCard, PropertyColor } from "../types/card.types";
import type { PlayerId, Difficulty } from "../types/game.types";

interface Base {
  readonly type: string;
  readonly seq: number;
  readonly gameId: string;
  readonly ts: string;
}

export interface GameStarted extends Base {
  readonly type: "GameStarted";
  readonly deck: Card[];
  readonly hands: Record<PlayerId, Card[]>;
  readonly difficulty: Difficulty;
}

export interface TurnStarted extends Base {
  readonly type: "TurnStarted";
  readonly activePlayer: PlayerId;
}

export interface CardsDrawn extends Base {
  readonly type: "CardsDrawn";
  readonly player: PlayerId;
  readonly cards: Card[];
}

export interface CardBanked extends Base {
  readonly type: "CardBanked";
  readonly player: PlayerId;
  readonly card: BankableCard;
}

export interface PropertyPlayed extends Base {
  readonly type: "PropertyPlayed";
  readonly player: PlayerId;
  readonly card: PropertyCard;
  readonly toColor: PropertyColor;
}

export interface PassGoPlayed extends Base {
  readonly type: "PassGoPlayed";
  readonly player: PlayerId;
  readonly cardId: string;
  readonly drawnCards: Card[];
}

export interface DoubleRentStacked extends Base {
  readonly type: "DoubleRentStacked";
  readonly player: PlayerId;
  readonly cardId: string;
}

export interface HousePlayed extends Base {
  readonly type: "HousePlayed";
  readonly player: PlayerId;
  readonly cardId: string;
  readonly color: PropertyColor;
}

export interface HotelPlayed extends Base {
  readonly type: "HotelPlayed";
  readonly player: PlayerId;
  readonly cardId: string;
  readonly color: PropertyColor;
}

/**
 * Emitted when any JSN-able action is played. Sets pendingReaction to jsnCheck.
 * The concrete effect (steal, rent, etc.) only fires after ActionResolved.
 */
export interface ActionInitiated extends Base {
  readonly type: "ActionInitiated";
  readonly player: PlayerId;
  readonly cardId: string;
  readonly actionKind:
    | "rent"
    | "slydeal"
    | "forceddeal"
    | "dealbreaker"
    | "debtcollector"
    | "birthday";
  readonly target: PlayerId;
  /** color for rent/dealbreaker */
  readonly color?: PropertyColor;
  /** for slydeal: the card the thief wants */
  readonly targetCardId?: string;
  /** for forceddeal: card being offered */
  readonly offeredCardId?: string;
  /** rent amount (pre-double) */
  readonly baseAmount?: number;
  readonly doubled: boolean;
}

export interface JustSayNoPlayed extends Base {
  readonly type: "JustSayNoPlayed";
  readonly player: PlayerId;
  readonly cardId: string;
  /** parity: even = original action is now blocked, odd = block was countered */
  readonly jsnChain: number;
}

export interface ActionBlocked extends Base {
  readonly type: "ActionBlocked";
  readonly triggerSeq: number;
}

export interface ActionAccepted extends Base {
  readonly type: "ActionAccepted";
  readonly triggerSeq: number;
}

export interface DebtOwed extends Base {
  readonly type: "DebtOwed";
  readonly creditor: PlayerId;
  readonly debtor: PlayerId;
  readonly amount: number;
}

export interface DebtPaid extends Base {
  readonly type: "DebtPaid";
  readonly payer: PlayerId;
  readonly recipient: PlayerId;
  readonly cards: Card[];
  readonly totalValue: number;
}

export interface PropertyStolen extends Base {
  readonly type: "PropertyStolen";
  readonly thief: PlayerId;
  readonly victim: PlayerId;
  readonly card: PropertyCard;
}

export interface SetStolen extends Base {
  readonly type: "SetStolen";
  readonly thief: PlayerId;
  readonly victim: PlayerId;
  readonly color: PropertyColor;
  readonly cards: PropertyCard[];
}

export interface CardSwapped extends Base {
  readonly type: "CardSwapped";
  readonly initiator: PlayerId;
  readonly target: PlayerId;
  readonly taken: PropertyCard;
  readonly given: PropertyCard;
}

export interface TurnEnded extends Base {
  readonly type: "TurnEnded";
  readonly player: PlayerId;
}

export interface CardsDiscarded extends Base {
  readonly type: "CardsDiscarded";
  readonly player: PlayerId;
  readonly cards: Card[];
}

export interface GameEnded extends Base {
  readonly type: "GameEnded";
  readonly winner: PlayerId;
}

export type GameEvent =
  | GameStarted
  | TurnStarted
  | CardsDrawn
  | CardBanked
  | PropertyPlayed
  | PassGoPlayed
  | DoubleRentStacked
  | HousePlayed
  | HotelPlayed
  | ActionInitiated
  | JustSayNoPlayed
  | ActionBlocked
  | ActionAccepted
  | DebtOwed
  | DebtPaid
  | PropertyStolen
  | SetStolen
  | CardSwapped
  | TurnEnded
  | CardsDiscarded
  | GameEnded;
