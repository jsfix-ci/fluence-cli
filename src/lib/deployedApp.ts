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
import { CliUx } from "@oclif/core";

import type { AquaCLI } from "./aquaCli";
import type { ServicesV3 } from "./configs/project/app";
import { FS_OPTIONS } from "./const";
import { capitalize } from "./helpers/capitilize";
import { replaceHomeDir } from "./helpers/replaceHomeDir";
import {
  ensureFluenceJSAppPath,
  ensureFluenceTSAppPath,
  ensureFluenceAquaDeployedAppPath,
  ensureFluenceJSDir,
  ensureFluenceTSDir,
} from "./paths";

const APP_SERVICE_NAME = "App";
const SERVICES_FUNCTION_NAME = "services";
const SERVICE_IDS_ITEM = "ServiceIdsItem";
const SERVICES_DATA_AQUA_TYPE = "Services";

export const getAppJson = (services: ServicesV3): string =>
  JSON.stringify(
    {
      name: APP_SERVICE_NAME,
      serviceId: APP_SERVICE_NAME,
      functions: [
        {
          name: SERVICES_FUNCTION_NAME,
          result: services,
        },
      ],
    },
    null,
    2
  );

const generateRegisterAppTSorJS = async ({
  deployedServices,
  aquaCli,
  isJS,
}: GenerateRegisterAppArg & {
  isJS: boolean;
}): Promise<void> => {
  await aquaCli({
    flags: {
      input: await ensureFluenceAquaDeployedAppPath(),
      output: await (isJS ? ensureFluenceJSDir() : ensureFluenceTSDir()),
      js: isJS,
    },
  });

  const appContent =
    // Codegeneration:
    `${isJS ? "" : 'import { FluencePeer } from "@fluencelabs/fluence";'}
import { registerApp as registerAppService } from "./deployed.app";

export const ${SERVICES_FUNCTION_NAME} = ${JSON.stringify(
      deployedServices,
      null,
      2
    )}

const service = {
  ${SERVICES_FUNCTION_NAME}: () => ${SERVICES_FUNCTION_NAME},
};

${
  isJS
    ? "export function registerApp(serviceIdOrPeer, maybeServiceId)"
    : `export function registerApp(): void;
export function registerApp(serviceId: string): void;
export function registerApp(peer: FluencePeer): void;
export function registerApp(peer: FluencePeer, serviceId: string): void;
export function registerApp(
  serviceIdOrPeer?: string | FluencePeer,
  maybeServiceId?: string
): void`
}{

  if (serviceIdOrPeer === undefined) {
    return registerAppService(service);
  }

  if (typeof serviceIdOrPeer === "string") {
    return registerAppService(serviceIdOrPeer, service);
  }

  if (maybeServiceId === undefined) {
    return registerAppService(serviceIdOrPeer, service);
  }

  return registerAppService(serviceIdOrPeer, maybeServiceId, service);
}
`;

  await fsPromises.writeFile(
    await (isJS ? ensureFluenceJSAppPath() : ensureFluenceTSAppPath()),
    appContent,
    FS_OPTIONS
  );
};

type GenerateRegisterAppArg = {
  deployedServices: ServicesV3;
  aquaCli: AquaCLI;
};

export const generateRegisterApp = async (
  options: GenerateRegisterAppArg
): Promise<void> => {
  CliUx.ux.action.start(
    `Compiling ${color.yellow(
      replaceHomeDir(await ensureFluenceAquaDeployedAppPath())
    )}`
  );

  await generateRegisterAppTSorJS({ ...options, isJS: true });
  await generateRegisterAppTSorJS({ ...options, isJS: false });
  CliUx.ux.action.stop();
};

const getDeploysDataName = (serviceName: string): string =>
  `${capitalize(serviceName)}Deploys`;

export const generateDeployedAppAqua = async (
  services: ServicesV3
): Promise<void> => {
  const appServicesFilePath = await ensureFluenceAquaDeployedAppPath();

  const appServicesAqua =
    // Codegeneration:
    `export App

data ${SERVICE_IDS_ITEM}:
  blueprintId: string
  peerId: string
  serviceId: string

${Object.entries(services)
  .map(
    ([serviceName, deployments]): string =>
      `data ${getDeploysDataName(serviceName)}:\n${Object.keys(deployments)
        .map(
          (deployName: string): string =>
            `  ${deployName}: []${SERVICE_IDS_ITEM}`
        )
        .join("\n")}`
  )
  .join("\n\n")}

data ${SERVICES_DATA_AQUA_TYPE}:
${Object.keys(services)
  .map(
    (serviceName): string =>
      `  ${serviceName}: ${getDeploysDataName(serviceName)}`
  )
  .join("\n")}

service ${APP_SERVICE_NAME}("${APP_SERVICE_NAME}"):
  ${SERVICES_FUNCTION_NAME}: -> ${SERVICES_DATA_AQUA_TYPE}
`;

  await fsPromises.writeFile(appServicesFilePath, appServicesAqua, FS_OPTIONS);
};
