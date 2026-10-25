<p align="center">
  <img width="120" alt="Logo" src="../web/public/images/logo.svg">
  <h1 align="center">@bustit/engine</h1>
</p>
<p align="center">
  The blackjack rules of bustit as pure functions.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

## Table of Contents

- [Introduction](#introduction)
  - [Features](#features)
- [Development](#development)

## Introduction

The engine is the dealer of bustit. It shuffles the shoe, deals, plays the dealer's hand and settles
every hand of a round. It knows the stakes of each hand, but not whose money they are: a seat is
just an index. Users, balances, betting and timers belong to the game server, which uses the engine.

The engine has no I/O, no timers and no framework. Randomness is injected, so a round can be played
again with the same seed. Every call returns a new round as plain JSON and leaves the one passed in
unchanged, so rounds can be stored, logged and replayed.

### Features

- Shoe with a configurable number of decks and reshuffle point
- Hit, stand, double down and split, including split aces and resplits
- The dealer's play, with or without hitting soft 17, and the hole card rule
- Settlement of every hand, with a configurable blackjack payout
- Events of what happened in a round, which never reveal a face-down card
- A public view of a round for clients, without the hole card or the shoe
- Invalid bets and actions return an error code instead of throwing

## Development

Builds the engine to `dist/`, where the server consumes it from.

```bash
npm run build -w @bustit/engine
```

Runs the scenario and invariant tests.

```bash
npm run test -w @bustit/engine
```

The house edge simulation, which checks the rules against the published house edge, lives in the bot
package, as it needs the basic strategy. See [`@bustit/bot`](../bot).
