import type { IAIStrategy } from "./ai-strategy.interface";
import type { GameState } from "../../domain/types/game.types";
import type { GameCommand } from "../../domain/commands/game.commands";
import type {
  Card,
  PropertyCard,
  ActionCard,
  RentCard,
  PropertyColor,
} from "../../domain/types/card.types";
import { calcRent } from "../../domain/rules/rent.calculator";
import { isComplete } from "../../domain/rules/set.rules";

function byValue(a: Card, b: Card): number {
  return a.value - b.value;
}

export const mediumStrategy: IAIStrategy = {
  difficulty: "medium",

  decide(state: GameState): GameCommand | null {
    const ai = state.players.ai;
    const base = { gameId: state.gameId, issuedBy: "ai" as const };

    if (state.phase === "draw") {
      return { ...base, type: "DrawCards" };
    }

    if (state.phase !== "action") return null;
    if (state.turn.activePlayer !== "ai") return null;
    if (state.turn.playsLeft === 0) return { ...base, type: "EndTurn" };

    const hand = [...ai.hand].sort(byValue);

    // 1. Play Pass Go first (free cards)
    const pg = hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "passgo"
    );
    if (pg) return { ...base, type: "PlayPassGo", cardId: pg.id };

    // 2. Play properties (prefer to complete sets)
    const props = hand.filter((c): c is PropertyCard => c.kind === "property");
    if (props.length) {
      // Pick the property that brings us closest to completing a set
      const sorted = [...props].sort((a, b) => {
        const aProgress = (ai.sets[a.color]?.length ?? 0);
        const bProgress = (ai.sets[b.color]?.length ?? 0);
        return bProgress - aProgress;
      });
      const best = sorted[0];
      return {
        ...base,
        type: "PlayProperty",
        cardId: best.id,
        toColor: best.color,
      };
    }

    // 3. Charge rent if we have properties
    const rentCards = hand.filter((c): c is RentCard => c.kind === "rent");
    for (const rc of rentCards) {
      const colors = rc.isWild
        ? (Object.keys(ai.sets) as PropertyColor[])
        : rc.colors.filter((col) => (ai.sets[col]?.length ?? 0) > 0);
      if (colors.length === 0) continue;
      const best = colors.reduce((best, col) => {
        const rentA = calcRent(ai.sets, col, false, ai.houses, ai.hotels);
        const rentB = calcRent(ai.sets, best, false, ai.houses, ai.hotels);
        return rentA > rentB ? col : best;
      }, colors[0]);
      if (calcRent(ai.sets, best, false, ai.houses, ai.hotels) > 0) {
        return { ...base, type: "PlayRent", cardId: rc.id, chosenColor: best };
      }
    }

    // 4. Debt collector / Birthday
    const dc = hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "debtcollector"
    );
    if (dc) {
      return { ...base, type: "PlayDebtCollector", cardId: dc.id, target: "player" };
    }

    const bday = hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "birthday"
    );
    if (bday) return { ...base, type: "PlayBirthday", cardId: bday.id };

    // 5. Sly Deal — steal from incomplete player set
    const sly = hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "slydeal"
    );
    if (sly) {
      const playerSets = state.players.player.sets;
      const targetColor = (
        Object.keys(playerSets) as PropertyColor[]
      ).find((col) => !isComplete(playerSets, col));
      if (targetColor) {
        const targetCard = playerSets[targetColor]?.[0];
        if (targetCard) {
          return {
            ...base,
            type: "PlaySlyDeal",
            cardId: sly.id,
            targetPlayer: "player",
            targetCardId: targetCard.id,
          };
        }
      }
    }

    // 6. Deal Breaker — steal a complete player set
    const db = hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "dealbreaker"
    );
    if (db) {
      const playerSets = state.players.player.sets;
      const targetColor = (
        Object.keys(playerSets) as PropertyColor[]
      ).find((col) => isComplete(playerSets, col));
      if (targetColor) {
        return {
          ...base,
          type: "PlayDealBreaker",
          cardId: db.id,
          targetPlayer: "player",
          targetColor,
        };
      }
    }

    // 7. Bank lowest value card
    const bankable = hand.find((c) => c.kind !== "property");
    if (bankable) {
      return { ...base, type: "BankCard", cardId: bankable.id };
    }

    return { ...base, type: "EndTurn" };
  },

  decideJsn(state: GameState, _triggerSeq: number): GameCommand | null {
    // Medium AI: only play JSN if opponent would win or steal a complete set
    const ai = state.players.ai;
    const hand = ai.hand;
    const jsn = hand.find(
      (c): c is ActionCard => c.kind === "action" && c.subtype === "jsn"
    );
    if (!jsn) return null;
    // Always block for now (can tune difficulty here)
    return { gameId: state.gameId, issuedBy: "ai", type: "RespondJsn", jsnCardId: jsn.id };
  },

  decideDebt(
    state: GameState,
    amountOwed: number,
    triggerSeq: number
  ): GameCommand {
    const ai = state.players.ai;
    const base = { gameId: state.gameId, issuedBy: "ai" as const };
    // Pay with lowest-value bank cards first
    const sorted = [...ai.bank].sort(byValue);
    const bankCards: typeof ai.bank = [];
    let total = 0;
    for (const card of sorted) {
      if (total >= amountOwed) break;
      bankCards.push(card);
      total += card.value;
    }
    // If still not enough, give properties (cheapest first)
    const propertyCards: PropertyCard[] = [];
    if (total < amountOwed) {
      const allProps = (Object.values(ai.sets) as PropertyCard[][])
        .flat()
        .sort(byValue);
      for (const card of allProps) {
        if (total >= amountOwed) break;
        // Don't break a set needed for win
        propertyCards.push(card);
        total += card.value;
      }
    }
    return {
      ...base,
      type: "PayDebt",
      bankCards,
      propertyCards,
      triggerSeq,
    };
  },
};
