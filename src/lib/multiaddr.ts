/**
 * Copyright 2022 Fluence Labs Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from "node:assert";

import { krasnodar, testNet } from "@fluencelabs/fluence-network-environment";

import type { CommandObj } from "./const";

const defaultEnvs = [...krasnodar, ...testNet];
export const defaultAddr = defaultEnvs.map(
  ({ multiaddr }): string => multiaddr
);
const defaultRelayIds = defaultEnvs.map(({ peerId }): string => peerId);

export const getRelayAddr = ({
  peerId,
  commandObj,
  getInfoForRandom,
}: {
  peerId?: string | undefined;
  commandObj: CommandObj;
  getInfoForRandom: (randomRelayAddr: string) => string;
}): string => {
  if (typeof peerId === "string") {
    const maybeAddr = defaultAddr.find((addr): boolean =>
      addr.includes(peerId)
    );
    if (typeof maybeAddr === "string") {
      return maybeAddr;
    }
  }

  const largestIndex = defaultAddr.length - 1;
  const randomIndex = Math.round(Math.random() * largestIndex);

  const randomRelayAddr = defaultAddr[randomIndex];
  assert(randomRelayAddr !== undefined);
  commandObj.log(getInfoForRandom(randomRelayAddr));
  return randomRelayAddr;
};

export const getRelayId = ({
  relayAddr,
  commandObj,
  getInfoForRandom,
}: {
  relayAddr?: string | undefined;
  commandObj: CommandObj;
  getInfoForRandom: (randomRelayId: string) => string;
}): string => {
  if (typeof relayAddr === "string") {
    const maybePeerId = defaultRelayIds.find((peerId): boolean =>
      relayAddr.includes(peerId)
    );
    if (typeof maybePeerId === "string") {
      return maybePeerId;
    }
  }

  const largestIndex = defaultRelayIds.length - 1;
  const randomIndex = Math.round(Math.random() * largestIndex);

  const randomRelayId = defaultRelayIds[randomIndex];
  assert(randomRelayId !== undefined);
  commandObj.log(getInfoForRandom(randomRelayId));

  return randomRelayId;
};