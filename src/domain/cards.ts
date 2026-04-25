export const PROPERTY_COLORS = [
  "brown",
  "lightBlue",
  "pink",
  "orange",
  "red",
  "yellow",
  "green",
  "darkBlue",
  "railroad",
  "utility"
] as const;

export type PropertyColor = (typeof PROPERTY_COLORS)[number];

export interface PropertyColorConfig {
  label: string;
  hex: string;
  text: string;
  setSize: number;
  rent: readonly number[];
  canImprove: boolean;
}

export const PROPERTY_CONFIG: Record<PropertyColor, PropertyColorConfig> = {
  brown: {
    label: "Brown",
    hex: "#7a4a2a",
    text: "#fff8ef",
    setSize: 2,
    rent: [1, 2],
    canImprove: true
  },
  lightBlue: {
    label: "Light Blue",
    hex: "#87cce8",
    text: "#12202a",
    setSize: 3,
    rent: [1, 2, 3],
    canImprove: true
  },
  pink: {
    label: "Pink",
    hex: "#d957a7",
    text: "#fff8fb",
    setSize: 3,
    rent: [1, 2, 4],
    canImprove: true
  },
  orange: {
    label: "Orange",
    hex: "#f29222",
    text: "#20160b",
    setSize: 3,
    rent: [1, 3, 5],
    canImprove: true
  },
  red: {
    label: "Red",
    hex: "#d43131",
    text: "#fff9f7",
    setSize: 3,
    rent: [2, 3, 6],
    canImprove: true
  },
  yellow: {
    label: "Yellow",
    hex: "#f2d34f",
    text: "#211b08",
    setSize: 3,
    rent: [2, 4, 6],
    canImprove: true
  },
  green: {
    label: "Green",
    hex: "#288454",
    text: "#f5fff9",
    setSize: 3,
    rent: [2, 4, 7],
    canImprove: true
  },
  darkBlue: {
    label: "Dark Blue",
    hex: "#204f9c",
    text: "#f4f8ff",
    setSize: 2,
    rent: [3, 8],
    canImprove: true
  },
  railroad: {
    label: "Railroad",
    hex: "#4a5058",
    text: "#f8fafc",
    setSize: 4,
    rent: [1, 2, 3, 4],
    canImprove: false
  },
  utility: {
    label: "Utility",
    hex: "#8bbf57",
    text: "#101709",
    setSize: 2,
    rent: [1, 2],
    canImprove: false
  }
};

export type ActionType =
  | "passGo"
  | "dealBreaker"
  | "slyDeal"
  | "forcedDeal"
  | "debtCollector"
  | "birthday"
  | "justSayNo"
  | "doubleRent"
  | "house"
  | "hotel";

export interface CardBase {
  id: string;
  name: string;
  value: number;
}

export interface PropertyCard extends CardBase {
  kind: "property";
  color: PropertyColor;
}

export interface PropertyWildCard extends CardBase {
  kind: "propertyWild";
  colors: readonly PropertyColor[];
  anyColor: boolean;
}

export type TablePropertyCard = PropertyCard | PropertyWildCard;

export interface MoneyCard extends CardBase {
  kind: "money";
}

export interface ActionCard extends CardBase {
  kind: "action";
  action: ActionType;
}

export interface RentCard extends CardBase {
  kind: "rent";
  colors: readonly PropertyColor[];
  anyColor: boolean;
  scope: "one" | "all";
}

export type Card = PropertyCard | PropertyWildCard | MoneyCard | ActionCard | RentCard;

export const isPropertyCard = (card: Card): card is PropertyCard =>
  card.kind === "property";

export const isPropertyWildCard = (card: Card): card is PropertyWildCard =>
  card.kind === "propertyWild";

export const isTablePropertyCard = (card: Card): card is TablePropertyCard =>
  isPropertyCard(card) || isPropertyWildCard(card);

export const isMoneyCard = (card: Card): card is MoneyCard => card.kind === "money";

export const isActionCard = (card: Card): card is ActionCard =>
  card.kind === "action";

export const isRentCard = (card: Card): card is RentCard => card.kind === "rent";

export const isBankableCard = (
  card: Card
): card is MoneyCard | ActionCard | RentCard | PropertyWildCard =>
  card.kind !== "property" && card.value > 0;

export const isImprovementAction = (card: Card): card is ActionCard =>
  card.kind === "action" && (card.action === "house" || card.action === "hotel");

const toId = (name: string, serial: number) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${serial}`;

const propertySpecs: Array<[PropertyColor, string, number]> = [
  ["brown", "Mediterranean Avenue", 1],
  ["brown", "Baltic Avenue", 1],
  ["lightBlue", "Oriental Avenue", 1],
  ["lightBlue", "Vermont Avenue", 1],
  ["lightBlue", "Connecticut Avenue", 2],
  ["pink", "St. Charles Place", 2],
  ["pink", "States Avenue", 2],
  ["pink", "Virginia Avenue", 2],
  ["orange", "St. James Place", 2],
  ["orange", "Tennessee Avenue", 2],
  ["orange", "New York Avenue", 2],
  ["red", "Kentucky Avenue", 3],
  ["red", "Indiana Avenue", 3],
  ["red", "Illinois Avenue", 3],
  ["yellow", "Atlantic Avenue", 3],
  ["yellow", "Ventnor Avenue", 3],
  ["yellow", "Marvin Gardens", 3],
  ["green", "Pacific Avenue", 4],
  ["green", "North Carolina Avenue", 4],
  ["green", "Pennsylvania Avenue", 4],
  ["darkBlue", "Park Place", 4],
  ["darkBlue", "Boardwalk", 4],
  ["railroad", "Reading Railroad", 2],
  ["railroad", "Pennsylvania Railroad", 2],
  ["railroad", "B&O Railroad", 2],
  ["railroad", "Short Line", 2],
  ["utility", "Electric Company", 2],
  ["utility", "Water Works", 2]
];

const rentSpecs: Array<[readonly PropertyColor[], number]> = [
  [["brown", "lightBlue"], 2],
  [["pink", "orange"], 2],
  [["red", "yellow"], 2],
  [["green", "darkBlue"], 2],
  [["railroad", "utility"], 2],
  [PROPERTY_COLORS, 3]
];

const propertyWildSpecs: Array<[readonly PropertyColor[], string, number, number]> = [
  [["brown", "lightBlue"], "Wild Property: Brown / Light Blue", 1, 1],
  [["lightBlue", "railroad"], "Wild Property: Light Blue / Railroad", 4, 1],
  [["pink", "orange"], "Wild Property: Pink / Orange", 2, 2],
  [["red", "yellow"], "Wild Property: Red / Yellow", 3, 2],
  [["green", "darkBlue"], "Wild Property: Green / Dark Blue", 4, 1],
  [["green", "railroad"], "Wild Property: Green / Railroad", 4, 1],
  [["railroad", "utility"], "Wild Property: Railroad / Utility", 2, 1],
  [PROPERTY_COLORS, "Wild Property: Any Color", 0, 2]
];

const actionSpecs: Array<[ActionType, string, number, number]> = [
  ["passGo", "Pass Go", 1, 10],
  ["dealBreaker", "Deal Breaker", 5, 2],
  ["slyDeal", "Sly Deal", 3, 3],
  ["forcedDeal", "Forced Deal", 3, 3],
  ["debtCollector", "Debt Collector", 3, 3],
  ["birthday", "It's My Birthday", 2, 3],
  ["justSayNo", "Just Say No!", 4, 3],
  ["doubleRent", "Double the Rent", 1, 2],
  ["house", "House", 3, 3],
  ["hotel", "Hotel", 4, 2]
];

const moneySpecs: Array<[number, number]> = [
  [1, 6],
  [2, 5],
  [3, 3],
  [4, 3],
  [5, 2],
  [10, 1]
];

export const buildDeck = (): Card[] => {
  const cards: Card[] = [];
  let serial = 1;

  const nextId = (name: string) => toId(name, serial++);

  for (const [color, name, value] of propertySpecs) {
    cards.push({ id: nextId(name), kind: "property", color, name, value });
  }

  for (const [value, count] of moneySpecs) {
    for (let copy = 0; copy < count; copy += 1) {
      const name = `$${value}M`;
      cards.push({ id: nextId(`${name} money`), kind: "money", name, value });
    }
  }

  for (const [colors, name, value, count] of propertyWildSpecs) {
    for (let copy = 0; copy < count; copy += 1) {
      cards.push({
        id: nextId(name),
        kind: "propertyWild",
        colors,
        anyColor: colors.length === PROPERTY_COLORS.length,
        name,
        value
      });
    }
  }

  for (const [action, name, value, count] of actionSpecs) {
    for (let copy = 0; copy < count; copy += 1) {
      cards.push({ id: nextId(name), kind: "action", action, name, value });
    }
  }

  for (const [colors, count] of rentSpecs) {
    for (let copy = 0; copy < count; copy += 1) {
      const anyColor = colors.length === PROPERTY_COLORS.length;
      const label = anyColor
        ? "Wild Rent"
        : `Rent: ${colors.map((color) => PROPERTY_CONFIG[color].label).join(" / ")}`;
      cards.push({
        id: nextId(label),
        kind: "rent",
        colors,
        anyColor,
        scope: anyColor ? "one" : "all",
        name: label,
        value: anyColor ? 3 : 1
      });
    }
  }

  return cards;
};
