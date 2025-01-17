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

import crypto from "node:crypto";
import fsPromises from "node:fs/promises";
import path from "node:path";

import color from "@oclif/color";
import decompress from "decompress";
import filenamify from "filenamify";
import fetch from "node-fetch";

import { MODULE_TYPE_RUST } from "../configs/project/module";
import { WASM_EXT } from "../const";
import { ensureFluenceModulesDir, ensureFluenceServicesDir } from "../paths";
import { input } from "../prompt";

export const getHashOfString = (str: string): Promise<string> => {
  const md5Hash = crypto.createHash("md5");
  return new Promise((resolve): void => {
    md5Hash.on("readable", (): void => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = md5Hash.read();

      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        resolve(data.toString("hex"));
      }
    });

    md5Hash.write(str);
    md5Hash.end();
  });
};

const downloadFile = async (path: string, url: string): Promise<string> => {
  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error(`Failed when downloading ${color.yellow(url)}`);
  }

  const buffer = await res.buffer();
  await fsPromises.writeFile(path, buffer);
  return path;
};

type EnsureValidAquaNameArg = {
  stringToValidate: string | undefined;
} & Parameters<typeof input>[0];

export const AQUA_NAME_REQUIREMENTS =
  "must start with a lowercase letter and contain only letters, numbers, and underscores";

export const ensureValidAquaName = async ({
  stringToValidate,
  ...inputArg
}: EnsureValidAquaNameArg): Promise<string> => {
  if (
    stringToValidate === undefined ||
    validateAquaName(stringToValidate) !== true
  ) {
    return input({
      ...inputArg,
      message: `${inputArg.message} (${AQUA_NAME_REQUIREMENTS})`,
      validate: validateAquaName,
    });
  }

  return stringToValidate;
};

export const validateAquaName = (text: string): true | string =>
  /^[a-z]\w*$/.test(text) || AQUA_NAME_REQUIREMENTS;

const ARCHIVE_FILE = "archive.tar.gz";

const downloadAndDecompress = async (
  get: string,
  pathStart: string
): Promise<string> => {
  const hash = await getHashOfString(get);
  const cleanPrefix = get.replace(".tar.gz?raw=true", "");
  const withoutTrailingSlash = cleanPrefix.replace(/\/$/, "");

  const lastPortionOfPath =
    withoutTrailingSlash
      .split(withoutTrailingSlash.includes("/") ? "/" : "\\")
      .slice(-1)[0] ?? "";

  const prefix =
    lastPortionOfPath === "" ? "" : `${filenamify(lastPortionOfPath)}_`;

  const dirPath = path.join(pathStart, `${prefix}${hash}`);

  try {
    await fsPromises.access(dirPath);
    return dirPath;
  } catch {}

  await fsPromises.mkdir(dirPath, { recursive: true });
  const archivePath = path.join(dirPath, ARCHIVE_FILE);
  await downloadFile(archivePath, get);
  await decompress(archivePath, dirPath);
  await fsPromises.unlink(archivePath);
  return dirPath;
};

export const downloadModule = async (get: string): Promise<string> =>
  downloadAndDecompress(get, await ensureFluenceModulesDir());

export const downloadService = async (get: string): Promise<string> =>
  downloadAndDecompress(get, await ensureFluenceServicesDir());

export const isUrl = (unknown: string): boolean =>
  unknown.startsWith("http://") || unknown.startsWith("https://");

export const getModuleWasmPath = (config: {
  type?: string;
  name: string;
  $getPath: () => string;
}): string => {
  const fileName = `${config.name}.${WASM_EXT}`;
  const configDirName = path.dirname(config.$getPath());
  return config.type === MODULE_TYPE_RUST
    ? path.resolve(configDirName, "target", "wasm32-wasi", "release", fileName)
    : path.resolve(configDirName, fileName);
};

export const getModuleUrlOrAbsolutePath = (
  get: string,
  serviceDirPath: string
): string => (isUrl(get) ? get : path.resolve(serviceDirPath, get));
