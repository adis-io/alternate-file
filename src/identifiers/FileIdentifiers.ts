import {
  ok,
  error,
  Result,
  isError,
  allOk,
  okThen,
  okChain,
  errorReplace
} from "result-async";
import { pipe, zip, map } from "../utils/utils";

import * as Operations from "../operations";

import {
  FileIdentifier,
  createIdentifierForPath,
  isFilenameIdentifier
} from "./FileIdentifier";

export { FileIdentifiers as T };

export type IdentifierType = "directories" | "filename";

/** All the identifiers for a file path */
interface FileIdentifiers {
  directories: string[];
  filename: string;
  rootPath: string;
}

/**
 * Take a filePath and a possibly matching pattern, and either
 * extract the useful identifiers if there's a match,
 * or return an error if there isn't a match.
 */
export function getIdentifiersFromPath(
  filePath: string,
  pattern: string,
  rootPath: string
): Result<FileIdentifiers, string> {
  const operationGroups = Operations.patternToOperators(pattern);
  if (isError(operationGroups)) return operationGroups;

  return pipe(
    pattern,
    patternToMatcherRegex,
    capturesFromPath(filePath),
    okChain(capturesToIdentifiers(operationGroups.ok, rootPath)),
    errorReplace("no match")
  );
}

function patternToMatcherRegex(pattern: string): RegExp {
  return new RegExp(
    pattern.replace(Operations.allIdentifierSymbolsRegex, "(.+)")
  );
}

function capturesFromPath(path: string) {
  return function(regex: RegExp): Result<string[], string> {
    const matches = path.match(regex);

    if (!matches) return error("pattern doesn't match");

    const [, ...captures] = matches;
    return ok(captures);
  };
}

function capturesToIdentifiers(
  operationGroups: Operations.OperationGroup[],
  rootPath: string
) {
  return function(captures: string[]): Result<FileIdentifiers, null> {
    return pipe(
      zip(captures, operationGroups),
      map(([capture, operationGroup]) =>
        createIdentifierForPath(capture, operationGroup)
      ),
      allOk,
      okThen(combineIdentifiers(rootPath))
    );
  };
}

function combineIdentifiers(rootPath: string) {
  return function(fileIdentifierList: FileIdentifier[]): FileIdentifiers {
    return fileIdentifierList.reduce(
      (fileIdentifiers: FileIdentifiers, fileIdentifier: FileIdentifier) => {
        return isFilenameIdentifier(fileIdentifier)
          ? { ...fileIdentifiers, filename: fileIdentifier.value }
          : {
              ...fileIdentifiers,
              directories: [
                ...fileIdentifiers.directories,
                fileIdentifier.value
              ]
            };
      },
      {
        rootPath,
        directories: [],
        filename: ""
      }
    );
  };
}