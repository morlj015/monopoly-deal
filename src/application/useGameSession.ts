import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chooseBotEvents, type BotDifficulty } from "../domain/bot";
import type { DomainEvent } from "../domain/events";
import { DomainRuleViolation } from "../domain/errors";
import { applyEvents, projectEvents, type GameState } from "../domain/state";
import { publishDomainEvent, publishSnapshot } from "../telemetry";
import type { EventStore } from "./eventStore";
import { createBotGameEvents, createNewGameEvents } from "./session";

type CommandFactory = (state: GameState) => DomainEvent[];

const gameIdFrom = (events: readonly DomainEvent[]): string | null => {
  const start = events.find((event) => event.type === "GameStarted");
  return start?.type === "GameStarted" ? start.gameId : null;
};

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
};

export const useGameSession = (
  eventStore: EventStore,
  initialDifficulty: BotDifficulty = "medium"
) => {
  const [events, setEvents] = useState<DomainEvent[]>([]);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(initialDifficulty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventsRef = useRef<DomainEvent[]>([]);
  const busyRef = useRef(false);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const state = useMemo(() => projectEvents(events), [events]);

  const append = useCallback(
    async (newEvents: readonly DomainEvent[]) => {
      if (newEvents.length === 0) {
        return projectEvents(eventsRef.current);
      }

      const currentEvents = eventsRef.current;
      const gameId = gameIdFrom(currentEvents) ?? gameIdFrom(newEvents);
      if (!gameId) {
        throw new Error("Cannot append events before a game has started.");
      }

      await eventStore.appendEvents(gameId, newEvents, currentEvents.length);
      const merged = [...currentEvents, ...newEvents];
      const nextState = applyEvents(projectEvents(currentEvents), newEvents);
      newEvents.forEach((event, index) => {
        publishDomainEvent(gameId, currentEvents.length + index + 1, event);
      });
      publishSnapshot(nextState);
      eventsRef.current = merged;
      setEvents(merged);
      return nextState;
    },
    [eventStore]
  );

  const startNewGame = useCallback(
    async (nextDifficulty: BotDifficulty = difficulty) => {
      setBusy(true);
      setError(null);
      try {
        const newEvents = createNewGameEvents(nextDifficulty);
        const gameId = gameIdFrom(newEvents);
        if (!gameId) {
          throw new Error("New game did not produce a GameStarted event.");
        }
        await eventStore.appendEvents(gameId, newEvents, 0);
        newEvents.forEach((event, index) => publishDomainEvent(gameId, index + 1, event));
        publishSnapshot(projectEvents(newEvents));
        eventsRef.current = newEvents;
        setEvents(newEvents);
        setDifficulty(nextDifficulty);
      } catch (error) {
        setError(messageFromError(error));
      } finally {
        setBusy(false);
      }
    },
    [difficulty, eventStore]
  );

  const startBotGame = useCallback(
    async (playerCount: number, nextDifficulty: BotDifficulty = difficulty) => {
      setBusy(true);
      setError(null);
      try {
        const newEvents = createBotGameEvents(playerCount, nextDifficulty);
        const gameId = gameIdFrom(newEvents);
        if (!gameId) {
          throw new Error("New bot game did not produce a GameStarted event.");
        }
        await eventStore.appendEvents(gameId, newEvents, 0);
        newEvents.forEach((event, index) => publishDomainEvent(gameId, index + 1, event));
        publishSnapshot(projectEvents(newEvents));
        eventsRef.current = newEvents;
        setEvents(newEvents);
        setDifficulty(nextDifficulty);
      } catch (error) {
        setError(messageFromError(error));
      } finally {
        setBusy(false);
      }
    },
    [difficulty, eventStore]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const games = await eventStore.listGames();
        if (cancelled) {
          return;
        }

        if (games.length === 0) {
          const newEvents = createNewGameEvents(initialDifficulty);
          const gameId = gameIdFrom(newEvents);
          if (!gameId) {
            throw new Error("New game did not produce a GameStarted event.");
          }
          await eventStore.appendEvents(gameId, newEvents, 0);
          if (!cancelled) {
            eventsRef.current = newEvents;
            setEvents(newEvents);
            setDifficulty(initialDifficulty);
            newEvents.forEach((event, index) => publishDomainEvent(gameId, index + 1, event));
            publishSnapshot(projectEvents(newEvents));
          }
          return;
        }

        const storedEvents = await eventStore.loadEvents(games[0].id);
        if (!cancelled) {
          eventsRef.current = storedEvents;
          setEvents(storedEvents);
          publishSnapshot(projectEvents(storedEvents));
        }
      } catch (error) {
        if (!cancelled) {
          setError(messageFromError(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventStore, initialDifficulty]);

  const dispatch = useCallback(
    async (factory: CommandFactory): Promise<boolean> => {
      if (busyRef.current) {
        return false;
      }

      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const currentState = projectEvents(eventsRef.current);
        const newEvents = factory(currentState);
        await append(newEvents);
        return true;
      } catch (error) {
        if (error instanceof DomainRuleViolation) {
          setError(error.message);
          return false;
        }
        setError(messageFromError(error));
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [append]
  );

  const runBotStep = useCallback(async (playerId?: string): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }

    const currentState = projectEvents(eventsRef.current);
    const currentPlayerId = playerId ?? currentState.currentTurn;
    if (!currentPlayerId || currentState.players[currentPlayerId]?.role !== "bot") {
      return false;
    }
    const botEvents = chooseBotEvents(currentState, currentPlayerId, difficulty);
    if (!botEvents) {
      return false;
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await append(botEvents);
      return true;
    } catch (error) {
      setError(messageFromError(error));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [append, difficulty]);

  return {
    state,
    events,
    difficulty,
    setDifficulty,
    loading,
    busy,
    error,
    clearError: () => setError(null),
    dispatch,
    runBotStep,
    startNewGame,
    startBotGame
  };
};
