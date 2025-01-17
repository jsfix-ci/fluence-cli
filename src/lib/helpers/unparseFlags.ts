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

import type { CommandObj } from "../const";

const unparseFlag = (
  flagName: string,
  flagValue: string | number | boolean | undefined,
  commandObj: CommandObj
): string => {
  if (flagValue === undefined || flagValue === false) {
    return "";
  }

  return ` ${commandObj.config.windows ? "" : "\\\n"}-${
    flagName.length > 1 ? "-" : ""
  }${flagName}${flagValue === true ? "" : ` '${flagValue}'`}`;
};

export const unparseFlags = (
  flags: Record<
    string,
    string | number | boolean | undefined | Array<string | undefined>
  >,
  commandObj: CommandObj
): string =>
  Object.entries(flags)
    .flatMap(
      ([flagName, flagValue]): Array<string> =>
        Array.isArray(flagValue)
          ? flagValue.map((value): string =>
              unparseFlag(flagName, value, commandObj)
            )
          : [unparseFlag(flagName, flagValue, commandObj)]
    )
    .join("");
