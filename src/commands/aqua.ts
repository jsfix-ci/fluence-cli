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

import color from "@oclif/color";
import { Command, Flags } from "@oclif/core";
import chokidar from "chokidar";

import { initAquaCli } from "../lib/aquaCli";
import { NO_INPUT_FLAG } from "../lib/const";
import { getIsInteractive } from "../lib/helpers/getIsInteractive";
import { ensureFluenceAquaDir } from "../lib/paths";
import { input } from "../lib/prompt";

export default class Aqua extends Command {
  static override description =
    "Compile aqua file or directory that contains your .aqua files";
  static override examples = ["<%= config.bin %> <%= command.id %>"];
  static override flags = {
    input: Flags.string({
      description:
        "Path to an aqua file or an input directory that contains your .aqua files",
      helpValue: "<path>",
      char: "i",
    }),
    output: Flags.string({
      description:
        "Path to the output directory. Will be created if it doesn't exists",
      helpValue: "<path>",
      char: "o",
    }),
    import: Flags.string({
      description:
        "Path to a directory to import from. May be used several times",
      helpValue: "<path>",
      multiple: true,
    }),
    air: Flags.boolean({
      description: "Generate .air file instead of .ts",
      exclusive: ["js"],
    }),
    js: Flags.boolean({
      description: "Generate .js file instead of .ts",
      exclusive: ["air"],
    }),
    "log-level": Flags.string({
      description: "Set log level",
      helpValue: "<level>",
    }),
    const: Flags.string({
      description: "Set log level",
      helpValue: "<NAME=value>",
    }),
    "no-relay": Flags.boolean({
      description: "Do not generate a pass through the relay node",
    }),
    "no-xor": Flags.boolean({
      description: "Do not generate a wrapper that catches and displays errors",
    }),
    dry: Flags.boolean({
      description: "Checks if compilation is succeeded, without output",
    }),
    scheduled: Flags.boolean({
      description:
        "Generate air code for script storage. Without error handling wrappers and hops on relay. Will ignore other options",
    }),
    watch: Flags.boolean({
      description: "Watch aqua file or folder for changes and recompile",
      char: "w",
    }),
    ...NO_INPUT_FLAG,
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(Aqua);
    const isInteractive = getIsInteractive(flags);

    const {
      watch,
      input: inputFromFlags = await input({
        isInteractive,
        message:
          "Enter path to an aqua file or an input directory that contains your .aqua files",
        flagName: "input",
      }),
      output = await input({
        isInteractive,
        message:
          "Enter path to the output directory. Will be created if it doesn't exists",
        flagName: "input",
      }),
      import: importsFromFlags,
      ...aquaCliOptionalFlags
    } = flags;

    const aquaCliFlags = {
      input: inputFromFlags,
      output,
      import: [...(importsFromFlags ?? []), await ensureFluenceAquaDir()],
      ...aquaCliOptionalFlags,
    };

    const aquaCli = await initAquaCli(this);

    const compile = (): Promise<string> =>
      aquaCli({ flags: aquaCliFlags }, "Compiling");

    if (!watch) {
      return this.log(await compile());
    }

    const watchingNotification = (): void =>
      this.log(
        `Watching for changes at ${color.yellow(aquaCliFlags.input)}...`
      );

    watchingNotification();

    chokidar
      .watch(aquaCliFlags.input, {
        followSymlinks: false,
        usePolling: false,
        interval: 100,
        binaryInterval: 300,
        ignoreInitial: true,
      })
      .on("all", (): void => {
        compile()
          .then((output): void => {
            this.log(output);
            watchingNotification();
          })
          .catch((error): void => {
            this.log(error);
            return watchingNotification();
          });
      });
  }
}
