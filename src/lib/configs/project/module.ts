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

import type { JSONSchemaType } from "ajv";

import { CommandObj, MODULE_CONFIG_FILE_NAME } from "../../const";
import { ensureFluenceDir } from "../../paths";
import {
  getConfigInitFunction,
  InitConfigOptions,
  InitializedConfig,
  InitializedReadonlyConfig,
  getReadonlyConfigInitFunction,
  Migrations,
  GetDefaultConfig,
} from "../initConfig";

export const MODULE_TYPE_RUST = "rust";
export const MODULE_TYPE_COMPILED = "compiled";
export const MODULE_TYPES = [MODULE_TYPE_RUST, MODULE_TYPE_COMPILED] as const;

export type ModuleType = typeof MODULE_TYPES[number];

export type ConfigV0 = {
  version: 0;
  name: string;
  type?: ModuleType;
  maxHeapSize?: string;
  loggerEnabled?: boolean;
  loggingMask?: number;
  volumes?: Record<string, string>;
  preopenedFiles?: Array<string>;
  envs?: Record<string, string>;
  mountedBinaries?: Record<string, string>;
};

const configSchemaV0: JSONSchemaType<ConfigV0> = {
  type: "object",
  properties: {
    version: { type: "number", enum: [0] },
    type: { type: "string", enum: MODULE_TYPES, nullable: true },
    name: { type: "string" },
    maxHeapSize: { type: "string", nullable: true },
    loggerEnabled: { type: "boolean", nullable: true },
    loggingMask: { type: "number", nullable: true },
    volumes: { type: "object", nullable: true, required: [] },
    preopenedFiles: {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
    envs: { type: "object", nullable: true, required: [] },
    mountedBinaries: { type: "object", nullable: true, required: [] },
  },
  required: ["version", "name"],
};

const migrations: Migrations<Config> = [];

const examples = `
name: facade
type: rust # use this for modules written in rust and expected to be built with marine
maxHeapSize: "100" # 100 bytes
# maxHeapSize: 100K # 100 kilobytes
# maxHeapSize: 100 Ki # 100 kibibytes
# Max size of the heap that a module can allocate in format: <number><whitespace?><specificator?>
# where ? is an optional field and specificator is one from the following (case-insensitive):
# K, Kb - kilobyte; Ki, KiB - kibibyte; M, Mb - megabyte; Mi, MiB - mebibyte; G, Gb - gigabyte; Gi, GiB - gibibyte;
# Current limit is 4 GiB
loggerEnabled: true # true, if it allows module to use the Marine SDK logger.
loggingMask: 0 # manages the logging targets, described in here: https://doc.fluence.dev/marine-book/marine-rust-sdk/developing/logging#using-target-map
mountedBinaries:
  curl: /usr/bin/curl # a map of mounted binary executable files
preopenedFiles: # a list of files and directories that this module could access with WASI
  - ./dir
volumes: # a map of accessible files and their aliases.
# Aliases should be normally used in Marine module development because it's hard to know the full path to a file.
  aliasForSomePath: ./some/path
envs: # environment variables accessible by a particular module with standard Rust env API like this std::env::var(IPFS_ADDR_ENV_NAME).
  # Please note that Marine adds three additional environment variables. Module environment variables could be examined with repl
  ENV1: arg1
  ENV2: arg2`;

type Config = ConfigV0;
type LatestConfig = ConfigV0;
export type ModuleConfig = InitializedConfig<LatestConfig>;
export type ModuleConfigReadonly = InitializedReadonlyConfig<LatestConfig>;

const getInitConfigOptions = (
  configPath: string
): InitConfigOptions<Config, LatestConfig> => ({
  allSchemas: [configSchemaV0],
  latestSchema: configSchemaV0,
  migrations,
  name: MODULE_CONFIG_FILE_NAME,
  getSchemaDirPath: ensureFluenceDir,
  getConfigDirPath: (): string => configPath,
  examples,
});

export const initModuleConfig = (
  configPath: string,
  commandObj: CommandObj
): Promise<InitializedConfig<LatestConfig> | null> =>
  getConfigInitFunction(getInitConfigOptions(configPath))(commandObj);
export const initReadonlyModuleConfig = (
  configPath: string,
  commandObj: CommandObj
): Promise<InitializedReadonlyConfig<LatestConfig> | null> =>
  getReadonlyConfigInitFunction(getInitConfigOptions(configPath))(commandObj);

const getDefault: (name: string) => GetDefaultConfig<LatestConfig> =
  (name: string): GetDefaultConfig<LatestConfig> =>
  (): LatestConfig => ({
    version: 0,
    type: MODULE_TYPE_RUST,
    name,
  });

export const initNewReadonlyModuleConfig = (
  configPath: string,
  commandObj: CommandObj,
  name: string
): Promise<InitializedReadonlyConfig<LatestConfig> | null> =>
  getReadonlyConfigInitFunction(
    getInitConfigOptions(configPath),
    getDefault(name)
  )(commandObj);
