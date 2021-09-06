/*
 * Copyright 2021 Fraktalio D.O.O. All rights reserved.
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

/* eslint-disable @typescript-eslint/no-explicit-any,functional/no-class,@typescript-eslint/no-unused-vars */

import test from 'ava';

import { View } from '../domain/view';

import { MaterializedView, ViewStateRepository } from './materialized-view';

function isNumber(x: any): x is number {
  return typeof x === 'number';
}

function isString(x: any): x is string {
  return typeof x === 'string';
}

const view: View<number, number> = new View<number, number>((s, e) => {
  if (isNumber(e)) {
    return s + e;
  } else {
    return s;
  }
}, 0);

const view2: View<string, string> = new View<string, string>((s, e) => {
  if (isString(e)) {
    return s.concat(e);
  } else {
    return s;
  }
}, '');

// eslint-disable-next-line functional/no-let
let storage: number | null = null;
// eslint-disable-next-line functional/no-let
let storage2: string | null = null;

class ViewStateRepositoryImpl implements ViewStateRepository<number, number> {
  fetchState(_e: number): number | null {
    return storage;
  }
  save(s: number): number {
    storage = s;
    return s;
  }
}

class ViewStateRepository2Impl implements ViewStateRepository<string, string> {
  fetchState(_e: string): string | null {
    return storage2;
  }
  save(s: string): string {
    storage2 = s;
    return s;
  }
}

const repository: ViewStateRepository<number, number> =
  new ViewStateRepositoryImpl();

const repository2: ViewStateRepository<string, string> =
  new ViewStateRepository2Impl();

const materializedView: MaterializedView<number, number> = new MaterializedView<
  number,
  number
>(view, repository);

const materializedView2: MaterializedView<string, string> =
  new MaterializedView<string, string>(view2, repository2);

test('view-handle', (t) => {
  t.is(materializedView.handle(1), 1);
});

test('view2-handle', (t) => {
  t.is(materializedView2.handle('Yin'), 'Yin');
});
