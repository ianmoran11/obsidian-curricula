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

// src/plugin.ts
var plugin_exports = {};
__export(plugin_exports, {
  CurriculaPlugin: () => CurriculaPlugin
});
module.exports = __toCommonJS(plugin_exports);
var import_obsidian = require("obsidian");
var CurriculaPlugin = class extends import_obsidian.Plugin {
  onInit() {
    this.addCommand({
      id: "auto-tutor:start-new-course",
      name: "Start New Course",
      callback: () => {
      }
    });
    this.addRibbonIcon("graduation-cap", "Start New Course", () => {
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CurriculaPlugin
});
