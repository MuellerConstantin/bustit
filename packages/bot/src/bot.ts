import { availableActions } from '@bustit/engine';
import {
  PLAY_EVENT,
  type PlayAck,
  REALTIME_PATH,
  type TableStateMessage,
} from '@bustit/shared';
import { io } from 'socket.io-client';
import { fetchTable, issueTicket, login } from './api.js';
import type { BotAccount } from './env-file.js';
import type { BotOptions } from './options.js';
import { basicStrategy } from './strategy.js';

const ACK_TIMEOUT_MS = 5_000;
const SIT_RETRY_MS = 500;
const ACTION_RETRY_MS = 200;

/**
 * Plays one account at a table until its connection closes. The bot only
 * reacts to the table state the server sends: it sits down on a free seat,
 * bets the table minimum in every betting window and plays each of its turns
 * by basic strategy.
 *
 * @throws if logging in, the ticket, the table or joining fails.
 */
export async function runBot(
  account: BotAccount,
  { server, table }: BotOptions,
): Promise<void> {
  const log = (message: string) => {
    console.log(`[${account.username}] ${message}`);
  };

  const session = await login(server, account);
  const { minBet } = await fetchTable(server, session.accessToken, table);
  const ticket = await issueTicket(server, session.accessToken);
  const userId = session.user.id;

  const socket = io(server, {
    path: REALTIME_PATH,
    auth: { ticket },
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  const send = (event: string, payload: object) =>
    socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(event, payload) as Promise<PlayAck>;

  let latest: TableStateMessage | null = null;
  let sitting = false;
  /** The betting window the bot has bet in, by when it started. */
  let betWindow: string | null = null;
  /** The turn the bot has acted on last, so it doesn't send one twice. */
  let actedOn: string | null = null;

  async function sitDown(): Promise<void> {
    if (sitting || !latest || !socket.connected) {
      return;
    }

    const seat = latest.seats.indexOf(null);

    if (seat === -1) {
      return;
    }

    sitting = true;
    const ack = await send(PLAY_EVENT.sit, { tableId: table, seat });
    sitting = false;

    if (!ack.ok) {
      log(`could not sit down on seat ${seat}: ${ack.message}`);

      // Only a seat taken by someone else is worth another try; any other
      // error would repeat the same way, so the bot leaves instead.
      if (ack.error !== 'seat_taken') {
        socket.disconnect();
        return;
      }

      setTimeout(() => void sitDown(), SIT_RETRY_MS);
      return;
    }

    log(`sat down on seat ${seat}`);
  }

  async function bet(state: TableStateMessage, seat: number): Promise<void> {
    // An early end only moves `endsAt`, so the start tells windows apart.
    const window = state.timer?.kind === 'bet' ? state.timer.startedAt : null;

    if (!window || window === betWindow) {
      return;
    }

    if (state.bets.some((entry) => entry.seat === seat)) {
      return;
    }

    betWindow = window;
    const ack = await send(PLAY_EVENT.bet, { tableId: table, stake: minBet });

    if (!ack.ok) {
      log(`bet rejected: ${ack.message}`);

      // The balance doesn't refill, so a bot without Bucks can't play on.
      if (ack.error === 'insufficient_balance') {
        log('out of Bucks, leaving the table');
        socket.disconnect();
      }

      return;
    }

    log(`bet ${minBet}`);
  }

  async function act(state: TableStateMessage, seat: number): Promise<void> {
    const round = state.round;

    if (!round) {
      return;
    }

    const options = availableActions(round);

    if (!options || options.seat !== seat) {
      return;
    }

    const cards = round.seats.find((entry) => entry.seat === seat)?.hands[
      options.hand
    ]?.cards;
    const dealerUpCard = round.dealer.cards[0];

    if (!cards || !dealerUpCard) {
      throw new Error('The turn has no hand or dealer card to decide on');
    }

    const key = `${state.timer?.startedAt}:${options.hand}:${cards.length}`;

    if (key === actedOn) {
      return;
    }

    actedOn = key;
    const type = basicStrategy(
      cards,
      dealerUpCard,
      options.actions.map((action) => action.type),
    );
    const ack = await send(PLAY_EVENT.action, { tableId: table, type });

    if (!ack.ok) {
      // The pause of the turn isn't over yet, so the action is retried with
      // the latest state until the server accepts it.
      if (ack.error === 'action_too_early') {
        actedOn = null;
        setTimeout(() => {
          if (latest) {
            play(latest).catch(onError);
          }
        }, ACTION_RETRY_MS);
        return;
      }

      log(`${type} rejected: ${ack.message}`);
      return;
    }

    log(`${type}`);
  }

  async function play(state: TableStateMessage): Promise<void> {
    latest = state;
    const seat = state.seats.indexOf(userId);

    if (seat === -1) {
      await sitDown();
      return;
    }

    if (state.round?.phase === 'playerTurns') {
      await act(state, seat);
      return;
    }

    await bet(state, seat);
  }

  const onError = (error: unknown) => {
    log(`error: ${error instanceof Error ? error.message : String(error)}`);
  };

  const joined = await send(PLAY_EVENT.join, { tableId: table });

  if (!joined.ok) {
    throw new Error(`Joining the table failed: ${joined.message}`);
  }

  socket.on(PLAY_EVENT.state, (state: TableStateMessage) => {
    play(state).catch(onError);
  });

  if (joined.state) {
    await play(joined.state);
  }

  return new Promise((resolve) => {
    socket.once('disconnect', (reason) => {
      log(`disconnected: ${reason}`);
      resolve();
    });
  });
}
