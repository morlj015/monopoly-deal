import type { BankableCard, PropertyCard, PropertyColor } from "../types/card.types";
import type { PlayerId, Difficulty } from "../types/game.types";

interface Base {
  readonly type: string;
  readonly gameId: string;
  readonly issuedBy: PlayerId;
}

export interface StartGame extends Base {
  readonly type: "StartGame";
  readonly difficulty: Difficulty;
}

export interface DrawCards extends Base {
  readonly type: "DrawCards";
}

export interface BankCard extends Base {
  readonly type: "BankCard";
  readonly cardId: string;
}

export interface PlayProperty extends Base {
  readonly type: "PlayProperty";
  readonly cardId: string;
  readonly toColor: PropertyColor;
}

export interface PlayPassGo extends Base {
  readonly type: "PlayPassGo";
  readonly cardId: string;
}

export interface PlayDoubleRent extends Base {
  readonly type: "PlayDoubleRent";
  readonly cardId: string;
}

export interface PlayRent extends Base {
  readonly type: "PlayRent";
  readonly cardId: string;
  readonly chosenColor: PropertyColor;
}

export interface PlayBirthday extends Base {
  readonly type: "PlayBirthday";
  readonly cardId: string;
}

export interface PlayDebtCollector extends Base {
  readonly type: "PlayDebtCollector";
  readonly cardId: string;
  readonly target: PlayerId;
}

export interface PlaySlyDeal extends Base {
  readonly type: "PlaySlyDeal";
  readonly cardId: string;
  readonly targetPlayer: PlayerId;
  readonly targetCardId: string;
}

export interface PlayForcedDeal extends Base {
  readonly type: "PlayForcedDeal";
  readonly cardId: string;
  readonly targetPlayer: PlayerId;
  readonly targetCardId: string;
  readonly offeredCardId: string;
}

export interface PlayDealBreaker extends Base {
  readonly type: "PlayDealBreaker";
  readonly cardId: string;
  readonly targetPlayer: PlayerId;
  readonly targetColor: PropertyColor;
}

export interface PlayHouse extends Base {
  readonly type: "PlayHouse";
  readonly cardId: string;
  readonly targetColor: PropertyColor;
}

export interface PlayHotel extends Base {
  readonly type: "PlayHotel";
  readonly cardId: string;
  readonly targetColor: PropertyColor;
}

export interface RespondJsn extends Base {
  readonly type: "RespondJsn";
  /** play JSN card to block, or null to accept */
  readonly jsnCardId: string | null;
}

export interface PayDebt extends Base {
  readonly type: "PayDebt";
  readonly bankCards: BankableCard[];
  readonly propertyCards: PropertyCard[];
  readonly triggerSeq: number;
}

export interface GiveCard extends Base {
  readonly type: "GiveCard";
  readonly cardId: string;
  readonly triggerSeq: number;
}

export interface DiscardCards extends Base {
  readonly type: "DiscardCards";
  readonly cardIds: string[];
}

export interface EndTurn extends Base {
  readonly type: "EndTurn";
}

export type GameCommand =
  | StartGame
  | DrawCards
  | BankCard
  | PlayProperty
  | PlayPassGo
  | PlayDoubleRent
  | PlayRent
  | PlayBirthday
  | PlayDebtCollector
  | PlaySlyDeal
  | PlayForcedDeal
  | PlayDealBreaker
  | PlayHouse
  | PlayHotel
  | RespondJsn
  | PayDebt
  | GiveCard
  | DiscardCards
  | EndTurn;
