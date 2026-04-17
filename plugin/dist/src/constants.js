"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/constants.ts
var constants_exports = {};
__export(constants_exports, {
  OPENROUTER_BASE_URL: () => OPENROUTER_BASE_URL,
  STAGES: () => STAGES,
  VAULT_PATHS: () => VAULT_PATHS
});
module.exports = __toCommonJS(constants_exports);
var OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
var STAGES = [0, 1, 2, 3, 4];
var VAULT_PATHS = {
  RAW_SOURCES: "1-Raw_Sources",
  MARKDOWN_SOURCES: "2-Markdown_Sources",
  SYNTHESIZED: "3-Synthesized",
  CURRICULUM: "4-Curriculum"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OPENROUTER_BASE_URL,
  STAGES,
  VAULT_PATHS
});
