export type PropertyColor =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue"
  | "railroad"
  | "utility";

export type ActionSubtype =
  | "passgo"
  | "dealbreaker"
  | "slydeal"
  | "forceddeal"
  | "debtcollector"
  | "birthday"
  | "jsn"
  | "doublerent"
  | "house"
  | "hotel";

export interface PropertyCard {
  readonly kind: "property";
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly color: PropertyColor;
  readonly colors?: readonly PropertyColor[]; // present on wild cards; lists all valid placement colors
}

export interface MoneyCard {
  readonly kind: "money";
  readonly id: string;
  readonly value: number;
}

export interface ActionCard {
  readonly kind: "action";
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly subtype: ActionSubtype;
  readonly amount?: number;
}

export interface RentCard {
  readonly kind: "rent";
  readonly id: string;
  readonly value: number;
  readonly colors: PropertyColor[];
  readonly isWild: boolean;
}

export type Card = PropertyCard | MoneyCard | ActionCard | RentCard;
export type BankableCard = MoneyCard | ActionCard | RentCard;
