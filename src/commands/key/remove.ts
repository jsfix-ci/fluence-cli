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

import color from "@oclif/color";
import { Command, Flags } from "@oclif/core";

import { initProjectSecretsConfig } from "../../lib/configs/project/projectSecrets";
import { initUserSecretsConfig } from "../../lib/configs/user/userSecrets";
import {
  FLUENCE_DIR_NAME,
  NAME_FLAG_NAME,
  NO_INPUT_FLAG,
  SECRETS_CONFIG_FILE_NAME,
} from "../../lib/const";
import { ensureFluenceProject } from "../../lib/helpers/ensureFluenceProject";
import { getIsInteractive } from "../../lib/helpers/getIsInteractive";
import { replaceHomeDir } from "../../lib/helpers/replaceHomeDir";
import { getProjectKeyPair, getUserKeyPair } from "../../lib/keypairs";
import { list } from "../../lib/prompt";

export default class Remove extends Command {
  static override description = `Remove key-pair from user's or project's ${FLUENCE_DIR_NAME}/${SECRETS_CONFIG_FILE_NAME}`;
  static override examples = ["<%= config.bin %> <%= command.id %>"];
  static override flags = {
    ...NO_INPUT_FLAG,
    user: Flags.boolean({
      description:
        "Remove key-pair from current user instead of removing key-pair from current project",
    }),
  };
  static override args = [
    {
      name: NAME_FLAG_NAME,
      description: "Key-pair name",
    },
  ];
  async run(): Promise<void> {
    const { args, flags } = await this.parse(Remove);
    const isInteractive = getIsInteractive(flags);
    await ensureFluenceProject(this, isInteractive);
    const userSecretsConfig = await initUserSecretsConfig(this);
    const projectSecretsConfig = await initProjectSecretsConfig(this);

    const secretsConfigPath = replaceHomeDir(
      (flags.user ? userSecretsConfig : projectSecretsConfig).$getPath()
    );

    let keyPairName: unknown = args[NAME_FLAG_NAME];

    assert(typeof keyPairName === "string" || keyPairName === undefined);

    const validateKeyPairName = async (
      keyPairName: string | undefined
    ): Promise<true | string> => {
      if (keyPairName === undefined) {
        return "Key-pair name must be selected";
      }

      return (
        (flags.user
          ? await getUserKeyPair({ commandObj: this, keyPairName })
          : await getProjectKeyPair({ commandObj: this, keyPairName })) !==
          undefined ||
        `Key-pair with name ${color.yellow(
          keyPairName
        )} doesn't exists at ${secretsConfigPath}. Please, choose another name.`
      );
    };

    if (flags.user && userSecretsConfig.keyPairs.length === 1) {
      this.error(
        `There is only one key-pair in ${secretsConfigPath} and it can't be removed, because having at least one user's key-pair is required.`
      );
    }

    const keyPairValidationResult = await validateKeyPairName(keyPairName);

    if (keyPairValidationResult !== true) {
      this.warn(keyPairValidationResult);

      keyPairName = await list({
        isInteractive,
        message: `Select key-pair name to remove at ${secretsConfigPath}`,
        oneChoiceMessage: (choice: string): string =>
          `Do you want to remove ${color.yellow(choice)}?`,
        onNoChoices: (): never =>
          this.error(
            `There are no key-pairs to remove at ${secretsConfigPath}`
          ),
        options: (flags.user
          ? userSecretsConfig
          : projectSecretsConfig
        ).keyPairs.map((value): string => value.name),
      });
    }

    assert(typeof keyPairName === "string");

    if (flags.user) {
      userSecretsConfig.keyPairs = userSecretsConfig.keyPairs.filter(
        ({ name }): boolean => name !== keyPairName
      );

      if (keyPairName === userSecretsConfig.defaultKeyPairName) {
        if (isInteractive) {
          const newDefaultKeyPairName = await list({
            isInteractive,
            message: `Select new default key-pair name for user's secrets`,
            oneChoiceMessage: (choice: string): string =>
              `Do you want to set ${color.yellow(choice)} as default key-pair?`,
            onNoChoices: (): never =>
              this.error(
                `Unreachable. There are no key-pairs to set as default for user's secrets`
              ),
            options: userSecretsConfig.keyPairs.map(
              (value): string => value.name
            ),
          });

          assert(typeof newDefaultKeyPairName === "string");

          userSecretsConfig.defaultKeyPairName = newDefaultKeyPairName;
        } else {
          userSecretsConfig.defaultKeyPairName =
            userSecretsConfig.keyPairs?.[0]?.name ?? this.error("Unreachable");
        }
      }

      await userSecretsConfig.$commit();
    } else {
      projectSecretsConfig.keyPairs = projectSecretsConfig.keyPairs.filter(
        ({ name }): boolean => name !== keyPairName
      );

      if (projectSecretsConfig.keyPairs.length === 0) {
        delete projectSecretsConfig.defaultKeyPairName;
      } else if (keyPairName === projectSecretsConfig.defaultKeyPairName) {
        if (isInteractive) {
          const newDefaultKeyPairName = await list({
            isInteractive,
            message: `Select new default key-pair name for project's secrets`,
            oneChoiceMessage: (choice: string): string =>
              `Do you want to set ${color.yellow(choice)} as default key-pair?`,
            onNoChoices: (): never =>
              this.error(
                `Unreachable. There are no key-pairs to set as default for project's secrets`
              ),
            options: projectSecretsConfig.keyPairs.map(
              (value): string => value.name
            ),
          });

          assert(typeof newDefaultKeyPairName === "string");

          projectSecretsConfig.defaultKeyPairName = newDefaultKeyPairName;
        } else {
          projectSecretsConfig.defaultKeyPairName =
            projectSecretsConfig?.keyPairs?.[0]?.name ??
            this.error("Unreachable");
        }
      }

      await projectSecretsConfig.$commit();
    }

    this.log(
      `Key-pair with name ${color.yellow(
        keyPairName
      )} successfully removed from ${secretsConfigPath}`
    );
  }
}
