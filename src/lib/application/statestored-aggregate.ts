/*
 * Copyright 2023 Fraktalio D.O.O. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "
 * AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific
 * language governing permissions and limitations under the License.
 */

/* eslint-disable functional/no-classes */

import { IDecider } from '../domain/decider';
import { ISaga } from '../domain/saga';

/**
 * State stored aggregate interface is using/delegating a `decider` of type `IDecider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 *
 * New state is then stored via `StateRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export interface IStateStoredAggregate<C, S, E>
  extends IDecider<C, S, E>,
    StateRepository<C, S> {
  readonly handle: (command: C) => Promise<S>;
}

/**
 * State stored locking aggregate interface is using/delegating a `decider` of type `IDecider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateLockingRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 *
 * New state is then stored via `StateLockingRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 * @typeParam V - The Version of the stored State
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export interface IStateStoredLockingAggregate<C, S, E, V>
  extends IDecider<C, S, E>,
    StateLockingRepository<C, S, V> {
  readonly handle: (command: C) => Promise<readonly [S, V]>;
}

/**
 * State stored orchestrating aggregate interface is using/delegating a `decider` of type `IDecider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 * If the `decider` is combined out of many deciders via `combine` function, an optional `saga` could be used to react on new events and send new commands to the `decider` recursively, in one transaction.
 *
 * New state is then stored via `StateRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export interface IStateStoredOrchestratingAggregate<C, S, E>
  extends IStateStoredAggregate<C, S, E>,
    ISaga<E, C> {}

/**
 * State stored orchestrating and locking aggregate interface is using/delegating a `decider` of type `IDecider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateLockingRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 * If the `decider` is combined out of many deciders via `combine` function, an optional `saga` could be used to react on new events and send new commands to the `decider` recursively, in one transaction.
 *
 * New state is then stored via `StateLockingRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 * @typeParam V - The Version of the stored State
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export interface IStateStoredOrchestratingLockingAggregate<C, S, E, V>
  extends IStateStoredLockingAggregate<C, S, E, V>,
    ISaga<E, C> {}

/**
 * `StateComputation` abstracts the `State Computation` algorithm by using a `decider` of type `IDecider`<`C`, `S,` `E`> to handle commands based on the current state, and produce new state.
 *
 * @typeParam C - Commands of type `C`
 * @typeParam S - State of type `S`
 * @typeParam E - Events of type `E`
 */
export abstract class StateComputation<C, S, E> implements IDecider<C, S, E> {
  protected constructor(protected readonly decider: IDecider<C, S, E>) {
    this.initialState = decider.initialState;
  }
  decide(c: C, s: S): readonly E[] {
    return this.decider.decide(c, s);
  }
  evolve(s: S, e: E): S {
    return this.decider.evolve(s, e);
  }

  readonly initialState: S;
  protected computeNewState(state: S, command: C): S {
    const events = this.decider.decide(command, state);
    return events.reduce(this.decider.evolve, state);
  }
}

/**
 * `StateOrchestratingComputation` abstracts the `Orchestrating State Computation` algorithm by using a `decider` of type `IDecider`<`C`, `S,` `E`> and `saga` of type `ISaga`<`E`, `C`> to handle commands based on the current state, and produce new state.
 * If the `decider` is combined out of many deciders via `combine` function, a `saga` could be used to react on new events and send new commands to the `decider` recursively, in single transaction.
 *
 * @typeParam C - Commands of type `C`
 * @typeParam S - State of type `S`
 * @typeParam E - Events of type `E`
 */
export abstract class StateOrchestratingComputation<C, S, E>
  extends StateComputation<C, S, E>
  implements IDecider<C, S, E>, ISaga<E, C>
{
  protected constructor(
    decider: IDecider<C, S, E>,
    protected readonly saga: ISaga<E, C>
  ) {
    super(decider);
  }
  react(ar: E): readonly C[] {
    return this.saga.react(ar);
  }
  protected override computeNewState(state: S, command: C): S {
    const events = this.decider.decide(command, state);
    // eslint-disable-next-line functional/no-let
    let newState = events.reduce(this.decider.evolve, state);
    events
      .flatMap((it) => this.saga.react(it))
      .forEach((c) => (newState = this.computeNewState(newState, c)));
    return newState;
  }
}

/**
 * State stored aggregate is using/delegating a `decider` of type `Decider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 *
 * New state is then stored via `StateRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export class StateStoredAggregate<C, S, E>
  extends StateComputation<C, S, E>
  implements IStateStoredAggregate<C, S, E>
{
  constructor(
    decider: IDecider<C, S, E>,
    protected readonly stateRepository: StateRepository<C, S>
  ) {
    super(decider);
  }

  async fetchState(c: C): Promise<S | null> {
    return this.stateRepository.fetchState(c);
  }

  async save(s: S): Promise<S> {
    return this.stateRepository.save(s);
  }

  async handle(command: C): Promise<S> {
    const currentState = await this.stateRepository.fetchState(command);
    return this.stateRepository.save(
      this.computeNewState(
        currentState ? currentState : this.decider.initialState,
        command
      )
    );
  }
}

/**
 * State stored locking aggregate is using/delegating a `decider` of type `Decider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateLockingRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 *
 * New state is then stored via `StateLockingRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 * @typeParam V - The Version of the stored State
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export class StateStoredLockingAggregate<C, S, E, V>
  extends StateComputation<C, S, E>
  implements IStateStoredLockingAggregate<C, S, E, V>
{
  constructor(
    decider: IDecider<C, S, E>,
    protected readonly stateRepository: StateLockingRepository<C, S, V>
  ) {
    super(decider);
  }
  async fetchState(c: C): Promise<readonly [S | null, V | null]> {
    return this.stateRepository.fetchState(c);
  }

  async save(s: S, v: V | null): Promise<readonly [S, V]> {
    return this.stateRepository.save(s, v);
  }
  async handle(command: C): Promise<readonly [S, V]> {
    const [currentState, version] = await this.stateRepository.fetchState(
      command
    );
    return this.stateRepository.save(
      this.computeNewState(
        currentState ? currentState : this.decider.initialState,
        command
      ),
      version
    );
  }
}

/**
 * State stored orchestrating aggregate is using/delegating a `decider` of type `IDecider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 * If the `decider` is combined out of many deciders via `combine` function, an optional `saga` could be used to react on new events and send new commands to the `decider` recursively, in one transaction.
 *
 * New state is then stored via `StateRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export class StateStoredOrchestratingAggregate<C, S, E>
  extends StateOrchestratingComputation<C, S, E>
  implements IStateStoredOrchestratingAggregate<C, S, E>
{
  constructor(
    decider: IDecider<C, S, E>,
    protected readonly stateRepository: StateRepository<C, S>,
    saga: ISaga<E, C>
  ) {
    super(decider, saga);
  }
  async fetchState(c: C): Promise<S | null> {
    return this.stateRepository.fetchState(c);
  }

  async save(s: S): Promise<S> {
    return this.stateRepository.save(s);
  }
  async handle(command: C): Promise<S> {
    const currentState = await this.stateRepository.fetchState(command);
    return this.stateRepository.save(
      this.computeNewState(
        currentState ? currentState : this.decider.initialState,
        command
      )
    );
  }
}

/**
 * State stored orchestrating (and locking) aggregate is using/delegating a `decider` of type `IDecider`<`C`, `S`, `E`> to handle commands and produce new state.
 * In order to handle the command, aggregate needs to fetch the current state via `StateLockingRepository.fetchState` function first, and then delegate the command to the `decider` which can produce new state as a result.
 * If the `decider` is combined out of many deciders via `combine` function, an optional `saga` could be used to react on new events and send new commands to the `decider` recursively, in one transaction.
 *
 * New state is then stored via `StateLockingRepository.save` function.
 *
 * @typeParam C - Commands of type `C` that this aggregate can handle
 * @typeParam S - Aggregate state of type `S`
 * @typeParam E - Events of type `E` that this aggregate can publish
 * @typeParam V - The Version of the stored State
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export class StateStoredOrchestratingLockingAggregate<C, S, E, V>
  extends StateOrchestratingComputation<C, S, E>
  implements IStateStoredOrchestratingLockingAggregate<C, S, E, V>
{
  constructor(
    decider: IDecider<C, S, E>,
    protected readonly stateRepository: StateLockingRepository<C, S, V>,
    saga: ISaga<E, C>
  ) {
    super(decider, saga);
  }

  async fetchState(c: C): Promise<readonly [S | null, V | null]> {
    return this.stateRepository.fetchState(c);
  }

  async save(s: S, v: V | null): Promise<readonly [S, V]> {
    return this.stateRepository.save(s, v);
  }

  async handle(command: C): Promise<readonly [S, V]> {
    const [currentState, version] = await this.stateRepository.fetchState(
      command
    );
    return this.stateRepository.save(
      this.computeNewState(
        currentState ? currentState : this.decider.initialState,
        command
      ),
      version
    );
  }
}

/**
 * State repository interface
 *
 * @param C - Command
 * @param S - State
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export interface StateRepository<C, S> {
  /**
   * Fetch state
   *
   * @param c - Command of type `C`
   *
   * @return current state of type `S`
   */
  readonly fetchState: (c: C) => Promise<S | null>;

  /**
   * Save state
   *
   * @param s - State of type `S`
   * @return newly saved State of type `S`
   */
  readonly save: (s: S) => Promise<S>;
}

/**
 * State Locking repository interface
 *
 * @param C - Command
 * @param S - State
 * @param V - Version
 *
 * @author Иван Дугалић / Ivan Dugalic / @idugalic
 */
export interface StateLockingRepository<C, S, V> {
  /**
   * Fetch state and version
   *
   * @param c - Command of type `C`
   * @return the pair of current State/[S] and current Version/[V]
   */
  readonly fetchState: (c: C) => Promise<readonly [S | null, V | null]>;

  /**
   * Save state
   *
   * You can update/save the item/state, but only if the `version` number in the storage has not changed.
   *
   * @param s - State of type `S`
   * @param v The current version of the state
   * @return newly saved State of type [S, V]
   */
  readonly save: (s: S, v: V | null) => Promise<readonly [S, V]>;
}
