import * as path from "path";
import {
  isOk,
  okThen,
  error,
  errorReplace,
  ResultP,
  okChainAsync
} from "result-async";
import { pipeA } from "pipeout";

import { fileExists, readFile, makeFile, ls } from "../utils/File";
import { map, titleCase } from "../utils/utils";
import { defaultConfigFileName } from "./ConfigFile";

const sampleConfigDirectory = path.resolve(__dirname, "../../sample-config");

/**
 * Create a .alternate-file.json5 file for a given directory, if it doesn't exist already.
 * @param currentPath - the directory to create a config file in. Probably the project root.
 * @param frameworkName -
 *   The name of the framework. If it's blank, creates a blank config file.
 *   If it's unknown, returns an error.
 * @returns The new config file path.
 */
export async function initializeConfigFile(
  currentPath: string,
  frameworkName: string
): ResultP<string, string> {
  const configPath = path.resolve(currentPath, defaultConfigFileName);

  if (isOk(await fileExists(configPath))) {
    return error(`${configPath} already exists!`);
  }

  // prettier-ignore
  return pipeA
    (frameworkName)
    (sampleFileName)
    (fileExists)
    (errorReplace(
      `sorry, ${frameworkName} doesn't have a default projections file yet.`
    ))
    (okChainAsync(readFile))
    (okChainAsync(contents => makeFile(configPath, contents)))
    .value
}

/**
 * Get a list of known frameworks, and their human-readable names.
 * @returns a list of [name, value] pairs. Send the value to initializeConfigFile.
 */
export async function possibleFrameworks(): ResultP<
  [string, string][],
  string
> {
  // prettier-ignore
  return pipeA
    (sampleConfigDirectory)
    (ls)
    (okThen(map(frameworkFromSampleFilename)))
    (okThen(frameworkNamesToTitlePair))
    .value
}

/** Returns the absolute path to a framework file. */
function sampleFileName(framework: string): string {
  const frameworkNamePart = framework ? `.${framework}` : "";
  return path.resolve(
    sampleConfigDirectory,
    `alternate-file${frameworkNamePart}.json`
  );
}

function frameworkFromSampleFilename(fileName: string): string {
  const matches = fileName.match(/alternate-file(?:\.(.+))?.json/);

  if (!matches) return "";

  return matches[1] || "";
}

function frameworkNamesToTitlePair(frameworks: string[]): [string, string][] {
  return frameworks.sort().map(framework => {
    const name = framework ? titleCase(framework) : "Empty";
    return [name, framework] as [string, string];
  });
}