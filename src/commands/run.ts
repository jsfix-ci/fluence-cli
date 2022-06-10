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

import fsPromises from "node:fs/promises";

import color from "@oclif/color";
import { Command, Flags } from "@oclif/core";
import type { JSONSchemaType } from "ajv";

import { ajv } from "../lib/ajv";
import { ensureAppServicesAquaFile } from "../lib/aqua/ensureAppServicesAquaFile";
import { initAquaCli } from "../lib/aquaCli";
import { initReadonlyAppConfig } from "../lib/configs/project/app";
import {
  CommandObj,
  FS_OPTIONS,
  NO_INPUT_FLAG,
  TIMEOUT_FLAG,
} from "../lib/const";
import { getIsInteractive } from "../lib/helpers/getIsInteractive";
import { usage } from "../lib/helpers/usage";
import { getRelayId, getRelayAddr } from "../lib/multiaddr";
import { getMaybeArtifactsPath } from "../lib/pathsGetters/getArtifactsPath";
import { getSrcAquaDirPath } from "../lib/pathsGetters/getSrcAquaDirPath";
import { confirm, input, list } from "../lib/prompt";

const FUNC_FLAG_NAME = "func";
const AQUA_FLAG_NAME = "aqua";
const ON_FLAG_NAME = "on";

export default class Run extends Command {
  static override description = "Run aqua script";

  static override examples = ["<%= config.bin %> <%= command.id %>"];

  static override flags = {
    relay: Flags.string({
      description: "Relay node MultiAddress",
      helpValue: "<multiaddr>",
    }),
    data: Flags.string({
      description:
        "JSON in { [argumentName]: argumentValue } format. You can call a function using these argument names",
      helpValue: "<json>",
    }),
    "data-path": Flags.string({
      description:
        "Path to a JSON file in { [argumentName]: argumentValue } format. You can call a function using these argument names",
      helpValue: "<path>",
    }),
    import: Flags.string({
      description:
        "Path to the directory to import from. May be used several times",
      helpValue: "<path>",
    }),
    [ON_FLAG_NAME]: Flags.string({
      description: "PeerId of the peer where you want to run the function",
      helpValue: "<peer_id>",
    }),
    [AQUA_FLAG_NAME]: Flags.string({
      description:
        "Path to an aqua file or to a directory that contains your aqua files",
      helpValue: "<path>",
    }),
    [FUNC_FLAG_NAME]: Flags.string({
      char: "f",
      description: "Function call",
      helpValue: "<function-call>",
    }),
    ...TIMEOUT_FLAG,
    ...NO_INPUT_FLAG,
  };

  static override usage: string = usage(this);

  async run(): Promise<void> {
    const { flags } = await this.parse(Run);
    const isInteractive = getIsInteractive(flags);

    const on = await ensurePeerId(flags.on, this, isInteractive);
    const aqua = await ensureAquaPath(flags[AQUA_FLAG_NAME], isInteractive);

    const func =
      flags[FUNC_FLAG_NAME] ??
      (await input({
        message: `Enter a function call that you want to execute`,
        isInteractive,
        flagName: FUNC_FLAG_NAME,
      }));

    const relay =
      flags.relay ??
      getRelayAddr({
        peerId: on,
        commandObj: this,
        getInfoForRandom: (relay): string =>
          `Random relay ${color.yellow(relay)} selected for connection`,
      });

    const data = await getRunData(flags, this);
    const imports = [
      flags.import,
      await ensureAppServicesAquaFile(this),
      await getMaybeArtifactsPath(),
    ];

    const aquaCli = await initAquaCli(this);
    const result = await aquaCli(
      {
        command: "run",
        flags: {
          addr: relay,
          func,
          input: aqua,
          on,
          timeout: flags.timeout,
          import: imports,
          ...data,
        },
      },
      "Running",
      { function: func, on, relay }
    );

    this.log(`\n${color.yellow("Result:")}\n\n${result}`);
  }
}

const ensurePeerId = async (
  onFromArgs: string | undefined,
  commandObj: CommandObj,
  isInteractive: boolean
): Promise<string> => {
  if (typeof onFromArgs === "string") {
    return onFromArgs;
  }
  const appConfig = await initReadonlyAppConfig(commandObj);

  const peerIdsFromDeployed = [
    ...new Set((appConfig?.services ?? []).map(({ peerId }): string => peerId)),
  ];
  const firstPeerId = peerIdsFromDeployed[0];
  if (peerIdsFromDeployed.length === 1 && firstPeerId !== undefined) {
    return firstPeerId;
  }

  const options =
    peerIdsFromDeployed.length > 1 &&
    (await confirm({
      message:
        "Do you want to select one of the peers from your app to run the function?",
      isInteractive,
      flagName: ON_FLAG_NAME,
    }))
      ? peerIdsFromDeployed
      : [
          getRelayId({
            commandObj,
            getInfoForRandom: (peerId): string =>
              `Random peer ${color.yellow(
                peerId
              )} to run your function selected`,
          }),
        ];

  return list({
    message: "Select peerId of the peer where you want to run the function",
    options,
    onNoChoices: (): Promise<string> =>
      input({
        message: "Enter peerId of the peer where you want to run your function",
        isInteractive,
        flagName: ON_FLAG_NAME,
      }),
    oneChoiceMessage: (peerId): string =>
      `Do you want to run your function on a random peer ${color.yellow(
        peerId
      )}`,
    isInteractive,
    flagName: ON_FLAG_NAME,
  });
};

const ensureAquaPath = async (
  aquaPathFromArgs: string | undefined,
  isInteractive: boolean
): Promise<string> => {
  if (typeof aquaPathFromArgs === "string") {
    return aquaPathFromArgs;
  }

  try {
    const srcAquaDirPath = getSrcAquaDirPath();
    await fsPromises.access(srcAquaDirPath);
    return srcAquaDirPath;
  } catch {
    return input({
      message:
        "Enter a path to an aqua file or to a directory that contains your aqua files",
      isInteractive,
      flagName: AQUA_FLAG_NAME,
    });
  }
};

type RunData = Record<string, unknown>;

const runDataSchema: JSONSchemaType<RunData> = {
  type: "object",
};

const validateRunData = ajv.compile(runDataSchema);

const getRunData = async (
  flags: { data: string | undefined; "data-path": string | undefined },
  commandObj: CommandObj
): Promise<{ data: string } | Record<string, never>> => {
  const appConfig = await initReadonlyAppConfig(commandObj);
  const runData: RunData =
    appConfig === null ? {} : { app: appConfig.services };
  const { data, "data-path": dataPath } = flags;

  if (typeof dataPath === "string") {
    let data: string;
    try {
      data = await fsPromises.readFile(dataPath, FS_OPTIONS);
    } catch {
      commandObj.error(
        `Can't read ${color.yellow(dataPath)}: No such file or directory`
      );
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(data);
    } catch {
      commandObj.error(`Unable to parse ${color.yellow(dataPath)}`);
    }
    if (!validateRunData(parsedData)) {
      commandObj.error(
        `Invalid ${color.yellow(dataPath)}: ${JSON.stringify(
          validateRunData.errors
        )}`
      );
    }
    for (const key in parsedData) {
      if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
        runData[key] = parsedData[key];
      }
    }
  }

  if (typeof data === "string") {
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(data);
    } catch {
      commandObj.error("Unable to parse --data");
    }
    if (!validateRunData(parsedData)) {
      commandObj.error(
        `Invalid --data: ${JSON.stringify(validateRunData.errors)}`
      );
    }
    for (const key in parsedData) {
      if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
        runData[key] = parsedData[key];
      }
    }
  }

  const dataString = JSON.stringify(runData);

  return dataString === "{}" ? {} : { data: dataString };
};