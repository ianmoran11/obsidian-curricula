"use strict";
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/plugin.ts
var import_obsidian11 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  openRouterApiKey: "",
  defaultModel: "",
  _modelsCache: null,
  promptOverrides: {
    stage0: "",
    stage1: "",
    stage3: "",
    stage4: ""
  }
};
function mergeSettings(data) {
  const saved = data ?? {};
  const promptOverrides = saved.promptOverrides ?? {};
  return {
    openRouterApiKey: saved.openRouterApiKey ?? DEFAULT_SETTINGS.openRouterApiKey,
    defaultModel: saved.defaultModel ?? DEFAULT_SETTINGS.defaultModel,
    _modelsCache: normalizeModelsCache(saved._modelsCache),
    promptOverrides: {
      stage0: promptOverrides.stage0 ?? DEFAULT_SETTINGS.promptOverrides.stage0,
      stage1: promptOverrides.stage1 ?? DEFAULT_SETTINGS.promptOverrides.stage1,
      stage3: promptOverrides.stage3 ?? DEFAULT_SETTINGS.promptOverrides.stage3,
      stage4: promptOverrides.stage4 ?? DEFAULT_SETTINGS.promptOverrides.stage4
    }
  };
}
function normalizeModelsCache(cache) {
  if (!cache || typeof cache !== "object") {
    return null;
  }
  const candidate = cache;
  if (!Array.isArray(candidate.data) || typeof candidate.cachedAt !== "number") {
    return null;
  }
  const data = candidate.data.flatMap((model) => {
    if (!model || typeof model !== "object") {
      return [];
    }
    const typedModel = model;
    if (typeof typedModel.id !== "string" || typeof typedModel.name !== "string" || typeof typedModel.contextLength !== "number") {
      return [];
    }
    return [{
      id: typedModel.id,
      name: typedModel.name,
      contextLength: typedModel.contextLength
    }];
  });
  if (data.length === 0) {
    return null;
  }
  return {
    data,
    cachedAt: candidate.cachedAt
  };
}
function buildModelOptions(models, selectedModel) {
  const options = models.map((model) => ({
    value: model.id,
    label: `${model.name} (${model.id})`
  }));
  if (selectedModel && !models.some((model) => model.id === selectedModel)) {
    options.unshift({
      value: selectedModel,
      label: `${selectedModel} (manual)`
    });
  }
  return options;
}
function pickDefaultModel(models, selectedModel) {
  const trimmedSelection = selectedModel.trim();
  if (trimmedSelection) {
    return trimmedSelection;
  }
  return models[0]?.id ?? "";
}
async function refreshModelCache(settings, openRouter) {
  const models = await openRouter.listModels({ forceRefresh: true });
  return {
    ...settings,
    defaultModel: pickDefaultModel(models, settings.defaultModel),
    _modelsCache: {
      data: models,
      cachedAt: Date.now()
    }
  };
}
async function verifyOpenRouterConnection(openRouter) {
  const models = await openRouter.listModels({ forceRefresh: true });
  return models.length;
}
var CurriculaSettingsTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin, settings) {
    super(app, plugin);
    this.ownerPlugin = plugin;
    this.settingsData = settings;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Curricula Settings" });
    this.addApiKeySection();
    this.addModelSection();
    this.addPromptSection("Stage 0 - Taxonomy", "stage0", this.settingsData.promptOverrides.stage0);
    this.addPromptSection("Stage 1 - Concepts", "stage1", this.settingsData.promptOverrides.stage1);
    this.addPromptSection("Stage 3 - Curriculum", "stage3", this.settingsData.promptOverrides.stage3);
    this.addPromptSection("Stage 4 - Lesson", "stage4", this.settingsData.promptOverrides.stage4);
  }
  addApiKeySection() {
    new import_obsidian.Setting(this.containerEl).setName("OpenRouter API Key").setDesc("Your API key for OpenRouter. Get one at openrouter.ai").addText((text) => {
      text.inputEl.type = "password";
      text.setValue(this.settingsData.openRouterApiKey);
      text.onChange(async (value) => {
        this.settingsData.openRouterApiKey = value;
        await this.persistSettings();
      });
    });
  }
  addModelSection() {
    const availableModels = this.settingsData._modelsCache?.data ?? [];
    const modelOptions = buildModelOptions(availableModels, this.settingsData.defaultModel);
    new import_obsidian.Setting(this.containerEl).setName("Default Model").setDesc("Model used for curriculum generation. Pick from fetched models or enter one manually below.").addDropdown((dropdown) => {
      dropdown.addOption("", "-- Select a model --");
      for (const option of modelOptions) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.settingsData.defaultModel);
      dropdown.onChange(async (value) => {
        this.settingsData.defaultModel = value;
        await this.persistSettings();
        this.display();
      });
    });
    new import_obsidian.Setting(this.containerEl).setName("Manual Model ID").setDesc("Fallback for models not returned by the API. Example: anthropic/claude-3.5-haiku").addText((text) => {
      text.setPlaceholder("anthropic/claude-3.5-haiku");
      text.setValue(this.settingsData.defaultModel);
      text.onChange(async (value) => {
        this.settingsData.defaultModel = value.trim();
        await this.persistSettings();
        this.display();
      });
    });
    new import_obsidian.Setting(this.containerEl).setName("Model Actions").setDesc("Refresh the model list from OpenRouter or verify your API key and connectivity.").addButton((button) => {
      button.setButtonText("Refresh models");
      button.setIcon("refresh");
      button.onClick(() => {
        void this.handleRefreshModels();
      });
    }).addButton((button) => {
      button.setButtonText("Test connection");
      button.onClick(() => {
        void this.handleTestConnection();
      });
    });
  }
  addPromptSection(title, key, value) {
    const setting = new import_obsidian.Setting(this.containerEl).setName(title).setDesc("Leave empty to use default prompt").addTextArea((text) => {
      text.inputEl.rows = 6;
      text.setValue(value);
      text.onChange(async (val) => {
        this.settingsData.promptOverrides[key] = val;
        await this.persistSettings();
      });
    });
    const resetBtn = setting.descEl.createEl("button", { text: "Reset to default" });
    resetBtn.onclick = async () => {
      this.settingsData.promptOverrides[key] = "";
      await this.persistSettings();
      this.display();
    };
  }
  async persistSettings() {
    if (this.ownerPlugin.applySettings) {
      await this.ownerPlugin.applySettings(this.settingsData);
      return;
    }
    await this.ownerPlugin.saveData(this.settingsData);
  }
  async handleRefreshModels() {
    if (!this.ownerPlugin.openRouter) {
      new import_obsidian.Notice("OpenRouter service is not available.");
      return;
    }
    if (!this.settingsData.openRouterApiKey.trim()) {
      new import_obsidian.Notice("Enter an OpenRouter API key before refreshing models.");
      return;
    }
    try {
      this.settingsData = await refreshModelCache(this.settingsData, this.ownerPlugin.openRouter);
      await this.persistSettings();
      this.display();
      new import_obsidian.Notice(`Fetched ${this.settingsData._modelsCache?.data.length ?? 0} models from OpenRouter.`);
    } catch (error) {
      new import_obsidian.Notice(`Model refresh failed: ${error.message}`);
    }
  }
  async handleTestConnection() {
    if (!this.ownerPlugin.openRouter) {
      new import_obsidian.Notice("OpenRouter service is not available.");
      return;
    }
    if (!this.settingsData.openRouterApiKey.trim()) {
      new import_obsidian.Notice("Enter an OpenRouter API key before testing the connection.");
      return;
    }
    try {
      const count = await verifyOpenRouterConnection(this.ownerPlugin.openRouter);
      this.settingsData = {
        ...this.settingsData,
        _modelsCache: this.ownerPlugin.openRouter.getModelsCache()
      };
      await this.persistSettings();
      this.display();
      new import_obsidian.Notice(`OpenRouter connection verified. ${count} models available.`);
    } catch (error) {
      new import_obsidian.Notice(`OpenRouter connection failed: ${error.message}`);
    }
  }
};
async function loadSettings(plugin) {
  try {
    const data = await plugin.loadData();
    return mergeSettings(data);
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return mergeSettings(void 0);
}

// src/constants.ts
var OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
var VAULT_PATHS = {
  RAW_SOURCES: "1-Raw_Sources",
  MARKDOWN_SOURCES: "2-Markdown_Sources",
  SYNTHESIZED: "3-Synthesized",
  CURRICULUM: "4-Curriculum"
};

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// src/services/validator.ts
var taxonomyNodeSchema = external_exports.lazy(
  () => external_exports.object({
    id: external_exports.string(),
    title: external_exports.string(),
    description: external_exports.string().optional(),
    children: external_exports.array(taxonomyNodeSchema)
  })
);
var courseMetaSchema = external_exports.object({
  courseId: external_exports.string(),
  seedTopic: external_exports.string(),
  createdAt: external_exports.string(),
  lastStageCompleted: external_exports.union([external_exports.literal(0), external_exports.literal(1), external_exports.literal(2), external_exports.literal(3), external_exports.literal(4), external_exports.null()]),
  modelUsed: external_exports.string()
});
var scopedTaxonomySchema = external_exports.object({
  courseId: external_exports.string(),
  root: taxonomyNodeSchema,
  selectedIds: external_exports.array(external_exports.string())
});
var conceptSchema = external_exports.object({
  id: external_exports.string(),
  name: external_exports.string(),
  definition: external_exports.string().max(200),
  sourceRefs: external_exports.array(external_exports.string())
});
var conceptListSchema = external_exports.object({
  courseId: external_exports.string(),
  concepts: external_exports.array(conceptSchema)
});
var likertScoreSchema = external_exports.union([external_exports.literal(1), external_exports.literal(2), external_exports.literal(3), external_exports.literal(4), external_exports.literal(5)]);
var proficiencyMapSchema = external_exports.object({
  courseId: external_exports.string(),
  scores: external_exports.record(external_exports.string(), likertScoreSchema)
});
var lessonSpecSchema = external_exports.object({
  id: external_exports.string(),
  title: external_exports.string(),
  summary: external_exports.string(),
  prerequisiteLessonIds: external_exports.array(external_exports.string()),
  relatedConceptIds: external_exports.array(external_exports.string()),
  difficulty: external_exports.union([external_exports.literal("intro"), external_exports.literal("intermediate"), external_exports.literal("advanced")]),
  condensed: external_exports.boolean()
});
var moduleSpecSchema = external_exports.object({
  id: external_exports.string(),
  title: external_exports.string(),
  lessons: external_exports.array(lessonSpecSchema)
});
var curriculumSchema = external_exports.object({
  courseId: external_exports.string(),
  title: external_exports.string(),
  modules: external_exports.array(moduleSpecSchema)
});
var generatedLessonSchema = external_exports.object({
  lessonId: external_exports.string(),
  filePath: external_exports.string(),
  status: external_exports.union([external_exports.literal("pending"), external_exports.literal("writing"), external_exports.literal("written"), external_exports.literal("error")]),
  error: external_exports.string().optional(),
  sourceRefs: external_exports.array(external_exports.string())
});
var generationProgressSchema = external_exports.object({
  courseId: external_exports.string(),
  lessons: external_exports.array(generatedLessonSchema),
  canvasPath: external_exports.string().optional(),
  indexPath: external_exports.string().optional(),
  startedAt: external_exports.string(),
  completedAt: external_exports.string().optional()
});
var stageCacheSchema = external_exports.object({
  meta: courseMetaSchema,
  stage0: scopedTaxonomySchema.optional(),
  stage1: conceptListSchema.optional(),
  stage2: proficiencyMapSchema.optional(),
  stage3: curriculumSchema.optional(),
  stage4: generationProgressSchema.optional()
});
var validators = {
  courseMeta: courseMetaSchema,
  taxonomyNode: taxonomyNodeSchema,
  scopedTaxonomy: scopedTaxonomySchema,
  concept: conceptSchema,
  conceptList: conceptListSchema,
  likertScore: likertScoreSchema,
  proficiencyMap: proficiencyMapSchema,
  lessonSpec: lessonSpecSchema,
  moduleSpec: moduleSpecSchema,
  curriculum: curriculumSchema,
  generatedLesson: generatedLessonSchema,
  generationProgress: generationProgressSchema,
  stageCache: stageCacheSchema
};
var ValidationError = class extends Error {
  constructor(message, details = []) {
    super(message);
    this.details = details;
    this.name = "ValidationError";
  }
};
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    throw new ValidationError("Validation failed", details);
  }
  return result.data;
}
function validateCourseMeta(data) {
  return validate(courseMetaSchema, data);
}
function validateScopedTaxonomy(data) {
  return validate(scopedTaxonomySchema, data);
}
function validateConceptList(data) {
  return validate(conceptListSchema, data);
}
function validateProficiencyMap(data) {
  return validate(proficiencyMapSchema, data);
}
function validateCurriculum(data) {
  return validate(curriculumSchema, data);
}

// src/services/cache.ts
var CacheService = class {
  constructor(adapter, pluginDir) {
    this.adapter = adapter;
    this.pluginDir = pluginDir;
  }
  cacheDir(courseId) {
    return `${this.pluginDir}/cache/${courseId}`;
  }
  normalizeLastCompletedStage(cache) {
    const stages = [cache.stage0, cache.stage1, cache.stage2, cache.stage3, cache.stage4];
    let lastCompleted = null;
    for (let stage = 0; stage < stages.length; stage++) {
      if (!stages[stage]) {
        break;
      }
      lastCompleted = stage;
    }
    return lastCompleted;
  }
  validateStageData(stage, data) {
    switch (stage) {
      case 0:
        return validateScopedTaxonomy(data);
      case 1:
        return validateConceptList(data);
      case 2:
        return validateProficiencyMap(data);
      case 3:
        return validateCurriculum(data);
      case 4:
        return validate(validators.generationProgress, data);
    }
  }
  async writeStage(courseId, stage, data, _currentCache) {
    const dir = this.cacheDir(courseId);
    await this.adapter.mkdir(dir);
    const tmpPath = `${dir}/stage${stage}.tmp`;
    const finalPath = `${dir}/stage${stage}.json`;
    const json = JSON.stringify(this.validateStageData(stage, data), null, 2);
    await this.adapter.write(tmpPath, json);
    await this.adapter.rename(tmpPath, finalPath);
  }
  async readCache(courseId) {
    const dir = this.cacheDir(courseId);
    try {
      const metaPath = `${dir}/meta.json`;
      const metaContent = await this.adapter.read(metaPath);
      const meta = validateCourseMeta(JSON.parse(metaContent));
      const cache = { meta };
      for (let stage = 0; stage <= 4; stage++) {
        const stagePath = `${dir}/stage${stage}.json`;
        try {
          const content = await this.adapter.read(stagePath);
          const stageData = this.validateStageData(
            stage,
            JSON.parse(content)
          );
          const stageKey = `stage${stage}`;
          cache[stageKey] = stageData;
        } catch {
        }
      }
      cache.meta.lastStageCompleted = this.normalizeLastCompletedStage(cache);
      return cache;
    } catch {
      return null;
    }
  }
  async writeMeta(courseId, meta) {
    const dir = this.cacheDir(courseId);
    await this.adapter.mkdir(dir);
    const tmpPath = `${dir}/meta.tmp`;
    const finalPath = `${dir}/meta.json`;
    await this.adapter.write(tmpPath, JSON.stringify(meta, null, 2));
    await this.adapter.rename(tmpPath, finalPath);
  }
  async getCourseIds() {
    const cacheRoot = `${this.pluginDir}/cache`;
    try {
      const files = await this.adapter.list(cacheRoot);
      const dirs = files.folders;
      return dirs.map((d) => {
        const parts = d.split("/");
        return parts[parts.length - 1];
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
  async clearCourse(courseId) {
    const dir = this.cacheDir(courseId);
    try {
      const files = await this.adapter.list(dir);
      for (const file of files.files) {
        await this.adapter.remove(file);
      }
      for (const folder of files.folders) {
        await this.adapter.remove(folder);
      }
      await this.adapter.remove(dir);
    } catch {
    }
  }
  async resumeFrom(courseId) {
    const cache = await this.readCache(courseId);
    if (!cache)
      return null;
    const lastStage = this.normalizeLastCompletedStage(cache);
    cache.meta.lastStageCompleted = lastStage;
    let nextStage;
    if (lastStage === null) {
      nextStage = 0;
    } else if (lastStage >= 4) {
      return null;
    } else {
      nextStage = lastStage + 1;
    }
    return { nextStage, cache };
  }
};

// src/services/lock.ts
var LOCK_FILE = ".auto-tutor.lock";
var LOCK_TIMEOUT_MS = 30 * 60 * 1e3;
var LockService = class {
  constructor(vault, adapter) {
    this.vault = vault;
    this.adapter = adapter;
  }
  getLockPath() {
    return `${this.vault.getRoot().path}/${LOCK_FILE}`;
  }
  async acquireLock(courseId, deviceName) {
    const lockPath = this.getLockPath();
    try {
      const existing = await this.getLockInfo();
      if (existing) {
        const age = Date.now() - existing.startedAt;
        if (age < LOCK_TIMEOUT_MS && existing.courseId !== courseId) {
          return false;
        }
      }
      const lockInfo = {
        courseId,
        deviceName,
        startedAt: Date.now()
      };
      const tmpPath = lockPath + ".tmp";
      await this.adapter.write(tmpPath, JSON.stringify(lockInfo));
      await this.adapter.rename(tmpPath, lockPath);
      return true;
    } catch {
      return false;
    }
  }
  async getLockInfo() {
    const lockPath = this.getLockPath();
    try {
      const content = await this.adapter.read(lockPath);
      const info = JSON.parse(content);
      if (Date.now() - info.startedAt >= LOCK_TIMEOUT_MS) {
        await this.releaseLock();
        return null;
      }
      return info;
    } catch {
      return null;
    }
  }
  async releaseLock() {
    const lockPath = this.getLockPath();
    try {
      await this.adapter.remove(lockPath);
    } catch {
    }
  }
  async isLockedByAnother(courseId) {
    const info = await this.getLockInfo();
    if (!info) {
      return { locked: false };
    }
    if (info.courseId !== courseId) {
      return { locked: true, info };
    }
    return { locked: false };
  }
  async clearStaleLocks() {
    const lockPath = this.getLockPath();
    try {
      const content = await this.adapter.read(lockPath);
      const info = JSON.parse(content);
      if (Date.now() - info.startedAt >= LOCK_TIMEOUT_MS) {
        await this.adapter.remove(lockPath);
      }
    } catch {
    }
  }
};

// src/services/openrouter.ts
var import_obsidian2 = require("obsidian");
var LlmError = class extends Error {
  constructor(message, status, body, retriable = false) {
    super(message);
    this.status = status;
    this.body = body;
    this.retriable = retriable;
    this.name = "LlmError";
  }
};
function isRetriable(status) {
  return status === 429 || status >= 500 && status < 600;
}
var OpenRouterService = class {
  constructor(opts) {
    this.modelsCache = null;
    this.CACHE_TTL_MS = 60 * 60 * 1e3;
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl;
  }
  updateConfig(opts) {
    const apiKeyChanged = opts.apiKey !== void 0 && opts.apiKey !== this.apiKey;
    const baseUrlChanged = opts.baseUrl !== void 0 && opts.baseUrl !== this.baseUrl;
    if (opts.apiKey !== void 0) {
      this.apiKey = opts.apiKey;
    }
    if (opts.baseUrl !== void 0) {
      this.baseUrl = opts.baseUrl;
    }
    if (apiKeyChanged || baseUrlChanged) {
      this.modelsCache = null;
    }
  }
  hydrateModelsCache(cache) {
    this.modelsCache = cache;
  }
  getModelsCache() {
    return this.modelsCache;
  }
  async listModels(options) {
    if (!options?.forceRefresh && this.modelsCache && Date.now() - this.modelsCache.cachedAt < this.CACHE_TTL_MS) {
      return this.modelsCache.data;
    }
    const response = await (0, import_obsidian2.requestUrl)({
      url: `${this.baseUrl}/models`,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "GET"
    });
    if (response.status !== 200) {
      throw new LlmError(
        `Failed to list models: ${response.status}`,
        response.status,
        response.text,
        isRetriable(response.status)
      );
    }
    const data = response.json;
    const models = data.data.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || 4096
    }));
    this.modelsCache = { data: models, cachedAt: Date.now() };
    return models;
  }
  async chat(opts) {
    const { model, messages, responseFormat, temperature, maxTokens, signal } = opts;
    let lastError = null;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new LlmError("Request aborted");
      }
      const body = {
        model,
        messages
      };
      if (responseFormat) {
        body.response_format = { type: responseFormat };
      }
      if (temperature !== void 0) {
        body.temperature = temperature;
      }
      if (maxTokens) {
        body.max_tokens = maxTokens;
      }
      try {
        const response = await (0, import_obsidian2.requestUrl)({
          url: `${this.baseUrl}/chat/completions`,
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify(body)
        });
        if (response.status === 429 || response.status >= 500 && response.status < 600) {
          const error = new LlmError(
            `Request failed: ${response.status}`,
            response.status,
            response.text,
            true
          );
          if (attempt < maxRetries - 1) {
            const jitterMs = Math.random() * 1e3 * Math.pow(2, attempt);
            await sleep(jitterMs);
            lastError = error;
            continue;
          }
          throw error;
        }
        if (response.status >= 400 && response.status !== 429) {
          throw new LlmError(
            `Request failed: ${response.status}`,
            response.status,
            response.text,
            false
          );
        }
        const data = response.json;
        return {
          content: data.choices[0]?.message?.content || "",
          usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0
          }
        };
      } catch (e) {
        if (e instanceof LlmError && e.retriable && attempt < maxRetries - 1) {
          const jitterMs = Math.random() * 1e3 * Math.pow(2, attempt);
          await sleep(jitterMs);
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    throw lastError || new LlmError("Max retries exceeded");
  }
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/services/context.ts
var ContextTooLargeError = class extends Error {
  constructor(message, currentByteLength, modelContextLength, suggestedModels = []) {
    super(message);
    this.currentByteLength = currentByteLength;
    this.modelContextLength = modelContextLength;
    this.suggestedModels = suggestedModels;
    this.name = "ContextTooLargeError";
  }
};
var KNOWLEDGE_ONLY_PLACEHOLDER = "(no user-provided sources \u2014 rely on your general knowledge of the topic)";
var SEPARATOR = "\n\n===== ";
var SEPARATOR_END = " =====\n\n";
var ContextBuilder = class {
  constructor(vault) {
    this.vault = vault;
  }
  async buildContext(modelContextLength = 4096) {
    const markdownPath = VAULT_PATHS.MARKDOWN_SOURCES;
    let markdownFiles = [];
    try {
      const root = this.vault.getRoot();
      const targetFolder = this.vault.getAbstractFileByPath(markdownPath);
      if (targetFolder) {
        markdownFiles = this.vault.getMarkdownFiles().filter((file) => {
          return file.path.startsWith(markdownPath + "/");
        });
      }
    } catch (e) {
    }
    if (markdownFiles.length === 0) {
      return {
        text: KNOWLEDGE_ONLY_PLACEHOLDER,
        files: [],
        byteLength: KNOWLEDGE_ONLY_PLACEHOLDER.length,
        mode: "knowledge-only"
      };
    }
    markdownFiles.sort((a, b) => a.path.localeCompare(b.path));
    const parts = [];
    const fileNames = [];
    let totalBytes = 0;
    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        const fileName = file.name;
        parts.push(SEPARATOR + fileName + SEPARATOR_END + content);
        fileNames.push(fileName);
        totalBytes += content.length;
      } catch (e) {
        continue;
      }
      if (parts.length > 20) {
        await yieldToMicrotask();
      }
    }
    const text = parts.join("");
    if (totalBytes > modelContextLength * 3) {
      const availableModels = this.getHigherContextModels();
      throw new ContextTooLargeError(
        `Context too large: ${totalBytes} bytes exceeds limit of ${modelContextLength * 3} bytes (~${modelContextLength} tokens \xD7 3). Please pick a larger-context model or trim sources.`,
        totalBytes,
        modelContextLength,
        availableModels
      );
    }
    return {
      text,
      files: fileNames,
      byteLength: totalBytes,
      mode: "grounded"
    };
  }
  getHigherContextModels() {
    return [
      "anthropic/claude-3.5-sonnet-200k",
      "openai/gpt-4-turbo-128k",
      "mistral/mistral-large-200k"
    ];
  }
  async buildKnowledgeOnlyContext() {
    return {
      text: KNOWLEDGE_ONLY_PLACEHOLDER,
      files: [],
      byteLength: KNOWLEDGE_ONLY_PLACEHOLDER.length,
      mode: "knowledge-only"
    };
  }
};
function yieldToMicrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// src/stages/stage0-topic.ts
var import_obsidian4 = require("obsidian");

// src/prompts/index.ts
var STAGE0_PROMPT = `You are a curriculum designer. Given a seed topic, produce a hierarchical taxonomy of the subject as JSON. Three levels max: area \u2192 sub-area \u2192 leaf topic. Each node has a stable dot-notation id, a title \u2264 60 chars, and an optional one-line description.

Output JSON EXACTLY matching:
{ "root": { "id": "...", "title": "...", "description": "...", "children": [ ... ] } }

Seed topic: {{seedTopic}}

Return JSON only. No prose, no markdown fences.`;
var STAGE1_PROMPT = `You extract foundational concepts for a learning curriculum, filtered by a user-defined scope.

You have TWO knowledge sources available:
  (a) USER-PROVIDED SOURCES below, which may be empty, partial, or authoritative.
  (b) Your own general knowledge of the topic from pre-training.

Use BOTH. Prefer the user-provided sources where they are authoritative on a concept; otherwise rely on your general knowledge. If no sources are provided, rely on general knowledge exclusively \u2014 this is a valid mode, not an error.

SCOPE (selected taxonomy node ids):
{{selectedNodeIds}}

USER-PROVIDED SOURCES (concatenated Markdown \u2014 may be empty):
---
{{contextText}}
---

Return JSON EXACTLY:
{ "concepts": [ { "id": "slug", "name": "...", "definition": "\u2264200 chars", "sourceRefs": ["filename.md"] } ] }

Rules:
- 15 \u2264 concepts.length \u2264 40.
- sourceRefs lists filenames from USER-PROVIDED SOURCES that directly support the concept. \`sourceRefs: []\` is valid and expected when the concept comes from general knowledge or when no sources were provided.
- Do NOT fabricate filenames. Only list files that actually appeared in USER-PROVIDED SOURCES.
- Ids are lowercase-hyphen slugs, unique within the list.
- Do not include concepts outside the scope.
- Return JSON only.`;
var STAGE3_PROMPT = `You are designing a personalised syllabus.

Draw on BOTH the user-provided sources below (which may be empty) and your own general knowledge of the topic. The curriculum should be comprehensive and well-structured even when sources are sparse or absent \u2014 lean on your pre-trained knowledge to fill gaps.

SCOPE: {{selectedNodeIds}}
CONCEPTS: {{concepts}}            (from Stage 1)
PROFICIENCY: {{proficiencyMap}}    (1=Unfamiliar \u2026 5=Expert)
USER-PROVIDED SOURCES (may be empty):
---
{{contextText}}
---

Produce a Curriculum matching this schema:
{ "title": "...", "modules": [ { "id": "...", "title": "...", "lessons": [
  { "id": "...", "title": "...", "summary": "...",
    "prerequisiteLessonIds": ["..."],
    "relatedConceptIds": ["..."],
    "difficulty": "intro"|"intermediate"|"advanced",
    "condensed": true|false } ] } ] }

Hard rules:
- Modules 3\u20137, each with 3\u20138 lessons.
- Absent sources do not reduce curriculum coverage. A knowledge-only run should produce the same shape as a grounded run.
- For any concept where the user scored \u22654, either omit lessons that only cover it OR set "condensed": true for the lesson and keep its summary \u2264 2 sentences.
- Every lesson has \u22651 entry in relatedConceptIds that exists in CONCEPTS.
- prerequisiteLessonIds must reference ids defined earlier in the same JSON document (no cycles).
- Return JSON only.`;
var STAGE4_PROMPT = `Write one lesson in Obsidian-flavoured Markdown.

You have TWO knowledge sources:
  (a) USER-PROVIDED SOURCES below, which may be empty, partial, or comprehensive.
  (b) Your own general knowledge of the topic from pre-training.

Use both. When user-provided sources cover the lesson's topic, prefer them \u2014 match their terminology, framing, and examples. When they don't cover it, or are absent entirely, draw freely on your general knowledge. A lesson written purely from general knowledge is valid and expected when no sources are provided. Do NOT refuse, stall, or apologise about missing sources \u2014 just teach the material.

LESSON SPEC: {{lesson}}
RELATED CONCEPTS (with definitions): {{relatedConcepts}}
USER-PROVIDED SOURCES (may be empty):
{{contextText}}

Output rules:
- Start with a level-1 heading equal to the lesson title.
- 400\u2013900 words unless "condensed": true, in which case 120\u2013250 words.
- Include at least one worked example and one "Check your understanding" question with answer in a callout (> [!question]).
- Use [[wikilinks]] to reference related concepts by their name field.
- Do NOT include YAML frontmatter \u2014 the plugin will inject it.
- Do NOT include navigation links \u2014 the plugin will inject breadcrumbs and prev/next.
- Do NOT include meta-commentary like "based on the provided sources" or "since no source was given" \u2014 write the lesson directly.
- Return raw Markdown only, no code fences around the whole file.`;
var KNOWLEDGE_ONLY_PLACEHOLDER2 = "(no user-provided sources \u2014 rely on your general knowledge of the topic)";
function composeStage0Prompt(seedTopic, template = STAGE0_PROMPT) {
  return template.replace("{{seedTopic}}", seedTopic);
}
function composeStage1Prompt(selectedNodeIds, contextText, template = STAGE1_PROMPT) {
  let context = contextText;
  if (!contextText || contextText.trim().length === 0) {
    context = KNOWLEDGE_ONLY_PLACEHOLDER2;
  }
  return template.replace("{{selectedNodeIds}}", selectedNodeIds.join(", ")).replace("{{contextText}}", context);
}
function composeStage3Prompt(selectedNodeIds, concepts, proficiencyMap, contextText, template = STAGE3_PROMPT) {
  let context = contextText;
  if (!contextText || contextText.trim().length === 0) {
    context = KNOWLEDGE_ONLY_PLACEHOLDER2;
  }
  return template.replace("{{selectedNodeIds}}", selectedNodeIds.join(", ")).replace("{{concepts}}", JSON.stringify(concepts)).replace("{{proficiencyMap}}", JSON.stringify(proficiencyMap.scores)).replace("{{contextText}}", context);
}
function composeStage4Prompt(lesson, relatedConcepts, contextText, template = STAGE4_PROMPT) {
  let context = contextText;
  if (!contextText || contextText.trim().length === 0) {
    context = KNOWLEDGE_ONLY_PLACEHOLDER2;
  }
  const conceptsWithDefs = relatedConcepts.filter((c) => lesson.relatedConceptIds.includes(c.id)).map((c) => `- ${c.name}: ${c.definition}`).join("\n");
  return template.replace("{{lesson}}", JSON.stringify(lesson)).replace("{{relatedConcepts}}", conceptsWithDefs).replace("{{contextText}}", context);
}
function isKnowledgeOnlyPlaceholder(text) {
  return text === KNOWLEDGE_ONLY_PLACEHOLDER2;
}

// src/ui/topic-input-modal.ts
var import_obsidian3 = require("obsidian");
var TopicInputModal = class extends import_obsidian3.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const coverMode = contentEl.offsetWidth < 500;
    contentEl.createEl("h2", { text: "Start New Course" });
    contentEl.createEl("p", {
      text: 'Enter a seed topic for your curriculum (e.g., "Machine Learning", "Guitar", "World War II"):'
    });
    this.errorEl = contentEl.createDiv("error-message");
    this.errorEl.style.color = "var(--text-error)";
    this.errorEl.style.display = "none";
    const inputWrapper = contentEl.createDiv("input-wrapper");
    this.inputEl = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "e.g., Machine Learning",
      cls: "topic-input"
    });
    this.inputEl.style.width = "100%";
    this.inputEl.style.padding = "12px";
    this.inputEl.style.margin = "8px 0";
    this.inputEl.style.minHeight = "48px";
    this.inputEl.style.fontSize = "16px";
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleSubmit();
      }
    });
    const buttonRow = contentEl.createDiv("button-row");
    buttonRow.style.display = "flex";
    buttonRow.style.flexDirection = coverMode ? "column" : "row";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "16px";
    this.submitButton = new import_obsidian3.ButtonComponent(buttonRow);
    this.submitButton.setButtonText("Generate Taxonomy");
    this.submitButton.setCta();
    this.submitButton.onClick(() => this.handleSubmit());
    const cancelButton = new import_obsidian3.ButtonComponent(buttonRow);
    cancelButton.setButtonText("Cancel");
    cancelButton.onClick(() => this.close());
    setTimeout(() => this.inputEl.focus(), 100);
  }
  handleSubmit() {
    const value = this.inputEl.value.trim();
    if (!value) {
      this.errorEl.setText("Please enter a topic");
      this.errorEl.style.display = "block";
      return;
    }
    this.errorEl.style.display = "none";
    this.onSubmit(value);
    this.close();
  }
};

// src/ui/responsive.ts
var COVER_MODE_THRESHOLD = 900;
function isCoverMode(viewportWidth) {
  return viewportWidth < COVER_MODE_THRESHOLD;
}

// src/ui/taxonomy-view.ts
var TaxonomyView = class {
  constructor(options) {
    this.container = options.container;
    this.nodes = options.nodes;
    this.selectedIds = options.selectedIds;
    this.onSelectionChange = options.onSelectionChange;
    this.onContinue = options.onContinue;
    this.render();
  }
  render() {
    this.container.empty();
    const coverMode = isCoverMode(document.body.offsetWidth);
    this.container.createEl("h2", { text: "Select Topics to Include" });
    this.container.createEl("p", {
      text: coverMode ? "Tap topics to include them. Use breadcrumbs to navigate." : "Check the topics you want in your curriculum. Nested topics are indented."
    });
    const treeContainer = this.container.createDiv("taxonomy-tree");
    treeContainer.style.maxHeight = "400px";
    treeContainer.style.overflowY = "auto";
    treeContainer.style.border = "1px solid var(--border-color)";
    treeContainer.style.borderRadius = "4px";
    treeContainer.style.padding = "8px";
    this.renderNode(treeContainer, this.nodes, coverMode);
    const footer = this.container.createDiv("taxonomy-footer");
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";
    footer.style.marginTop = "16px";
    footer.style.paddingTop = "16px";
    footer.style.borderTop = "1px solid var(--border-color)";
    const countEl = footer.createSpan("selected-count");
    this.updateCount(countEl);
    const buttonContainer = footer.createDiv("button-container");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "8px";
    const continueBtn = buttonContainer.createEl("button", { text: "Continue" });
    continueBtn.style.background = "var(--interactive-accent)";
    continueBtn.style.color = "var(--text-on-accent)";
    continueBtn.style.border = "none";
    continueBtn.style.padding = "12px 24px";
    continueBtn.style.borderRadius = "4px";
    continueBtn.style.cursor = "pointer";
    continueBtn.style.minHeight = "48px";
    continueBtn.style.minWidth = "120px";
    continueBtn.style.fontSize = "14px";
    continueBtn.style.fontWeight = "bold";
    continueBtn.addEventListener("click", () => {
      if (this.selectedIds.size > 0) {
        this.onContinue();
      }
    });
    continueBtn.disabled = this.selectedIds.size === 0;
    continueBtn.style.opacity = this.selectedIds.size === 0 ? "0.5" : "1";
    const selectAllBtn = buttonContainer.createEl("button", { text: "Select All" });
    selectAllBtn.style.background = "transparent";
    selectAllBtn.style.border = "1px solid var(--border-color)";
    selectAllBtn.style.padding = "12px 24px";
    selectAllBtn.style.borderRadius = "4px";
    selectAllBtn.style.cursor = "pointer";
    selectAllBtn.style.minHeight = "48px";
    selectAllBtn.style.minWidth = "100px";
    selectAllBtn.style.fontSize = "14px";
    selectAllBtn.addEventListener("click", () => this.selectAll());
  }
  renderNode(container, node, isCoverModeEnabled, depth = 0) {
    const nodeEl = container.createDiv("taxonomy-node");
    nodeEl.style.marginLeft = `${depth * 20}px`;
    nodeEl.style.padding = "4px 0";
    const rowEl = nodeEl.createDiv("node-row");
    rowEl.style.display = "flex";
    rowEl.style.alignItems = "center";
    rowEl.style.gap = "8px";
    rowEl.style.padding = "8px 4px";
    rowEl.style.minHeight = "48px";
    rowEl.style.cursor = "pointer";
    if (node.children.length > 0 && !isCoverModeEnabled) {
      const toggleEl = rowEl.createEl("span", { text: "\u25B6", cls: "expand-toggle" });
      toggleEl.style.cursor = "pointer";
      toggleEl.style.fontSize = "16px";
      toggleEl.style.width = "32px";
      toggleEl.style.height = "32px";
      toggleEl.style.display = "inline-flex";
      toggleEl.style.alignItems = "center";
      toggleEl.style.justifyContent = "center";
      toggleEl.style.minWidth = "32px";
      toggleEl.style.minHeight = "32px";
      toggleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const childContainer = nodeEl.querySelector(".children-container");
        if (childContainer) {
          const isExpanded = childContainer.style.display !== "none";
          childContainer.style.display = isExpanded ? "none" : "block";
          toggleEl.textContent = isExpanded ? "\u25B6" : "\u25BC";
        }
      });
    }
    const checkbox = rowEl.createEl("input", { type: "checkbox" });
    checkbox.checked = this.selectedIds.has(node.id);
    checkbox.style.width = "24px";
    checkbox.style.height = "24px";
    checkbox.style.cursor = "pointer";
    checkbox.style.minWidth = "24px";
    checkbox.style.minHeight = "24px";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        this.selectedIds.add(node.id);
      } else {
        this.selectedIds.delete(node.id);
      }
      if (node.children.length > 0) {
        this.cascadeSelection(node, checkbox.checked);
      }
      this.onSelectionChange(Array.from(this.selectedIds));
      this.updateDisplay();
    });
    const labelEl = rowEl.createEl("label", { text: node.title });
    labelEl.style.cursor = "pointer";
    labelEl.style.flex = "1";
    labelEl.style.minHeight = "48px";
    labelEl.style.display = "flex";
    labelEl.style.alignItems = "center";
    if (node.description) {
      labelEl.style.fontStyle = "italic";
      labelEl.style.color = "var(--text-muted)";
    }
    labelEl.addEventListener("click", () => {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });
    if (node.description) {
      labelEl.setAttribute("title", node.description);
    }
    if (node.children.length > 0) {
      const childContainer = nodeEl.createDiv("children-container");
      childContainer.style.display = "block";
      for (const child of node.children) {
        this.renderNode(childContainer, child, isCoverModeEnabled, depth + 1);
      }
    }
  }
  cascadeSelection(node, selected) {
    const setOrClear = selected ? (id) => this.selectedIds.add(id) : (id) => this.selectedIds.delete(id);
    const traverse = (n) => {
      setOrClear(n.id);
      n.children.forEach(traverse);
    };
    node.children.forEach(traverse);
  }
  updateDisplay() {
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      const htmlCb = cb;
      const nodeId = this.getNodeIdForCheckbox(htmlCb);
      if (nodeId) {
        htmlCb.checked = this.selectedIds.has(nodeId);
      }
    });
    const countEl = this.container.querySelector(".selected-count");
    if (countEl) {
      this.updateCount(countEl);
    }
    const continueBtn = this.container.querySelector("button:last-of-type");
    if (continueBtn) {
      continueBtn.disabled = this.selectedIds.size === 0;
      continueBtn.style.opacity = this.selectedIds.size === 0 ? "0.5" : "1";
    }
  }
  getNodeIdForCheckbox(checkbox) {
    const row = checkbox.closest(".node-row");
    const label = row?.querySelector("label");
    const title = label?.textContent;
    if (!title)
      return null;
    const findNode = (node2, title2) => {
      if (node2.title === title2)
        return node2;
      for (const child of node2.children) {
        const found = findNode(child, title2);
        if (found)
          return found;
      }
      return null;
    };
    const node = findNode(this.nodes, title);
    return node?.id || null;
  }
  updateCount(el) {
    const leafCount = this.countLeafNodes(this.nodes);
    const selectedLeaves = this.countSelectedLeaves(this.nodes);
    el.textContent = `${selectedLeaves} / ${leafCount} topics selected`;
  }
  countLeafNodes(node) {
    if (node.children.length === 0)
      return 1;
    return node.children.reduce((sum, child) => sum + this.countLeafNodes(child), 0);
  }
  countSelectedLeaves(node) {
    if (node.children.length === 0) {
      return this.selectedIds.has(node.id) ? 1 : 0;
    }
    return node.children.reduce((sum, child) => sum + this.countSelectedLeaves(child), 0);
  }
  selectAll() {
    const selectAllNodes = (node) => {
      this.selectedIds.add(node.id);
      node.children.forEach(selectAllNodes);
    };
    selectAllNodes(this.nodes);
    this.onSelectionChange(Array.from(this.selectedIds));
    this.updateDisplay();
  }
};
function createTaxonomyView(options) {
  return new TaxonomyView(options);
}
function hasAtLeastOneLeafSelected(nodes, selectedIds) {
  const checkLeaves = (node) => {
    if (node.children.length === 0) {
      return selectedIds.has(node.id);
    }
    return node.children.some(checkLeaves);
  };
  return checkLeaves(nodes);
}

// src/stages/stage0-topic.ts
var Stage0Runner = class {
  constructor(options) {
    this.taxonomy = null;
    this.selectedIds = /* @__PURE__ */ new Set();
    this.app = options.app;
    this.openRouter = options.openRouter;
    this.contextBuilder = options.contextBuilder;
    this.seedTopic = options.seedTopic;
    this.courseId = options.courseId;
    this.model = options.model;
    this.promptTemplate = options.promptTemplate;
    this.onComplete = options.onComplete;
    this.onCancel = options.onCancel;
  }
  async run() {
    new import_obsidian4.Notice("Generating taxonomy...");
    try {
      const prompt = composeStage0Prompt(this.seedTopic, this.promptTemplate);
      const result = await this.openRouter.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        responseFormat: "json_object"
      });
      let parsed;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        const retryPrompt = `Your previous response was not valid JSON. Return valid JSON only: ${result.content}`;
        const retryResult = await this.openRouter.chat({
          model: this.model,
          messages: [{ role: "user", content: retryPrompt }],
          responseFormat: "json_object"
        });
        parsed = JSON.parse(retryResult.content);
      }
      this.taxonomy = validateScopedTaxonomy(parsed).root;
      this.showTaxonomyView();
    } catch (error) {
      new import_obsidian4.Notice(`Taxonomy generation failed: ${error.message}`);
      this.onCancel();
    }
  }
  showTaxonomyView() {
    if (!this.taxonomy)
      return;
    const modalEl = document.body.createDiv();
    modalEl.style.position = "fixed";
    modalEl.style.top = "0";
    modalEl.style.left = "0";
    modalEl.style.right = "0";
    modalEl.style.bottom = "0";
    modalEl.style.background = "var(--background)";
    modalEl.style.zIndex = "1000";
    modalEl.style.overflowY = "auto";
    modalEl.style.padding = "20px";
    const contentEl = modalEl.createDiv("taxonomy-content");
    contentEl.style.maxWidth = "800px";
    contentEl.style.margin = "0 auto";
    const closeBtn = modalEl.createEl("button", { text: "\u2715" });
    closeBtn.style.position = "fixed";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.fontSize = "24px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.zIndex = "1001";
    closeBtn.addEventListener("click", () => {
      document.body.removeChild(modalEl);
      this.onCancel();
    });
    const view = createTaxonomyView({
      container: contentEl,
      nodes: this.taxonomy,
      selectedIds: this.selectedIds,
      onSelectionChange: (ids) => {
        this.selectedIds = new Set(ids);
      },
      onContinue: () => {
        if (this.taxonomy && hasAtLeastOneLeafSelected(this.taxonomy, this.selectedIds)) {
          this.complete();
          document.body.removeChild(modalEl);
        }
      }
    });
  }
  complete() {
    if (!this.taxonomy)
      return;
    const scopedTaxonomy = {
      courseId: this.courseId,
      root: this.taxonomy,
      selectedIds: Array.from(this.selectedIds)
    };
    new import_obsidian4.Notice(`Selected ${this.selectedIds.size} topics`);
    this.onComplete(scopedTaxonomy);
  }
};
async function runStage0(app, openRouter, contextBuilder, courseId, config) {
  return new Promise((resolve) => {
    let runner = null;
    const modal = new TopicInputModal(app, (seedTopic) => {
      runner = new Stage0Runner({
        app,
        openRouter,
        contextBuilder,
        seedTopic,
        courseId,
        model: config?.model ?? "anthropic/claude-3.5-haiku",
        promptTemplate: config?.promptTemplate,
        onComplete: (taxonomy) => resolve(taxonomy),
        onCancel: () => resolve(null)
      });
      runner.run();
    });
    modal.onClose = () => {
      if (!runner) {
        resolve(null);
      }
    };
    modal.open();
  });
}

// src/stages/stage1-concepts.ts
var import_obsidian5 = require("obsidian");
var Stage1Runner = class {
  constructor(options) {
    this.app = options.app;
    this.openRouter = options.openRouter;
    this.contextBuilder = options.contextBuilder;
    this.taxonomy = options.taxonomy;
    this.courseId = options.courseId;
    this.model = options.model;
    this.modelContextLength = options.modelContextLength;
    this.promptTemplate = options.promptTemplate;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }
  async run() {
    new import_obsidian5.Notice("Extracting concepts...");
    try {
      const contextResult = await this.contextBuilder.buildContext(this.modelContextLength);
      const prompt = composeStage1Prompt(
        this.taxonomy.selectedIds,
        contextResult.text,
        this.promptTemplate
      );
      const result = await this.openRouter.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        responseFormat: "json_object",
        temperature: 0.3
      });
      let parsed;
      try {
        parsed = validateConceptList(JSON.parse(result.content));
      } catch {
        const retryPrompt = `Your previous response failed validation. Return valid JSON only matching the ConceptList schema. ${result.content}`;
        const retryResult = await this.openRouter.chat({
          model: this.model,
          messages: [{ role: "user", content: retryPrompt }],
          responseFormat: "json_object",
          temperature: 0.3
        });
        parsed = validateConceptList(JSON.parse(retryResult.content));
      }
      if (parsed.concepts.length < 15 || parsed.concepts.length > 40) {
        new import_obsidian5.Notice(`Warning: ${parsed.concepts.length} concepts extracted (expected 15-40)`);
      }
      const conceptList = {
        courseId: this.courseId,
        concepts: parsed.concepts
      };
      new import_obsidian5.Notice(`Extracted ${conceptList.concepts.length} concepts`);
      this.onComplete(conceptList);
      return conceptList;
    } catch (error) {
      new import_obsidian5.Notice(`Concept extraction failed: ${error.message}`);
      this.onError(error);
      throw error;
    }
  }
};
async function runStage1(options) {
  const runner = new Stage1Runner(options);
  try {
    return await runner.run();
  } catch {
    return null;
  }
}

// src/ui/likert-modal.ts
var import_obsidian6 = require("obsidian");
var LIKERT_LABELS = ["Unfamiliar", "Slightly Familiar", "Moderately Familiar", "Very Familiar", "Expert"];
var LIKERT_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#27ae60"];
var LikertModal = class extends import_obsidian6.Modal {
  constructor(options) {
    super(options.app);
    this.currentIndex = 0;
    this.scores = {};
    this.conceptEls = [];
    this.cardsContainer = null;
    this.progressEl = null;
    this.coverMode = false;
    this.concepts = options.concepts;
    this.courseId = options.courseId;
    this.onComplete = options.onComplete;
    this.onCancel = options.onCancel;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.style.padding = "20px";
    contentEl.style.maxWidth = "100%";
    this.coverMode = isCoverMode(document.body.offsetWidth);
    contentEl.createEl("h2", { text: "Assess Your Proficiency" });
    contentEl.createEl("p", {
      text: 'Rate your familiarity with each concept from 1 (Unfamiliar) to 5 (Expert). Tap "Skip" if unsure.'
    });
    this.progressEl = contentEl.createDiv("likert-progress");
    this.progressEl.style.marginBottom = "16px";
    this.updateProgress();
    this.cardsContainer = contentEl.createDiv("likert-cards");
    this.cardsContainer.style.display = "flex";
    this.cardsContainer.style.overflowX = "auto";
    this.cardsContainer.style.scrollSnapType = "x mandatory";
    this.cardsContainer.style.gap = "16px";
    this.cardsContainer.style.padding = "8px 0";
    for (let i = 0; i < this.concepts.length; i++) {
      const card = this.createCard(this.concepts[i], i);
      this.conceptEls.push(card);
      this.cardsContainer.appendChild(card);
    }
    this.setupSwipeGestures();
    this.showCard(0);
  }
  createCard(concept, index) {
    const card = document.createElement("div");
    card.className = "likert-card";
    const cardWidth = this.coverMode ? "min(100%, 320px)" : "min(400px, 100%)";
    card.style.cssText = `
      width: ${cardWidth};
      min-width: 280px;
      max-width: 400px;
      flex: 0 0 ${this.coverMode ? "100%" : "auto"};
      scroll-snap-align: center;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: ${this.coverMode ? "16px" : "20px"};
      background: var(--background-secondary);
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;
    const conceptTitle = card.createEl("h3", { text: concept.name });
    conceptTitle.style.margin = "0";
    conceptTitle.style.fontSize = "18px";
    const definition = card.createEl("p", { text: concept.definition });
    definition.style.margin = "0";
    definition.style.color = "var(--text-muted)";
    definition.style.fontSize = "14px";
    const buttonsContainer = card.createDiv("likert-buttons");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.gap = "8px";
    buttonsContainer.style.marginTop = "auto";
    buttonsContainer.style.paddingTop = "16px";
    buttonsContainer.style.flexWrap = "wrap";
    buttonsContainer.style.justifyContent = "center";
    for (let score = 1; score <= 5; score++) {
      const btn = buttonsContainer.createEl("button", {
        text: `${score}`,
        title: LIKERT_LABELS[score - 1]
      });
      btn.style.cssText = `
        min-width: 48px;
        min-height: 48px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 2px solid ${LIKERT_COLORS[score - 1]};
        background: ${this.scores[concept.id] === score ? LIKERT_COLORS[score - 1] : "transparent"};
        color: ${this.scores[concept.id] === score ? "white" : LIKERT_COLORS[score - 1]};
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      btn.addEventListener("click", () => {
        this.selectScore(concept.id, score);
        this.goToNext();
      });
    }
    const skipBtn = buttonsContainer.createEl("button", { text: "Skip" });
    skipBtn.style.cssText = `
      min-width: 48px;
      min-height: 48px;
      padding: 0 16px;
      border-radius: 24px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
    `;
    skipBtn.addEventListener("click", () => this.goToNext());
    return card;
  }
  selectScore(conceptId, score) {
    this.scores[conceptId] = score;
    const cardIndex = this.concepts.findIndex((c) => c.id === conceptId);
    const card = this.conceptEls[cardIndex];
    if (!card)
      return;
    const buttons = card.querySelectorAll(".likert-buttons button");
    for (let i = 0; i < buttons.length - 1; i++) {
      const isSelected = i + 1 === score;
      const btn = buttons[i];
      btn.style.background = isSelected ? LIKERT_COLORS[i] : "transparent";
      btn.style.color = isSelected ? "white" : LIKERT_COLORS[i];
    }
  }
  setupSwipeGestures() {
    if (!this.cardsContainer)
      return;
    let startX = 0;
    let scrollLeft = 0;
    this.cardsContainer.addEventListener("touchstart", (e) => {
      startX = e.touches[0].pageX;
      scrollLeft = this.cardsContainer.scrollLeft;
    });
    this.cardsContainer.addEventListener("touchmove", (e) => {
      const x = e.touches[0].pageX;
      const walk = (startX - x) * 1.5;
      this.cardsContainer.scrollLeft = scrollLeft + walk;
    });
    this.cardsContainer.addEventListener("touchend", (e) => {
      const x = e.changedTouches[0].pageX;
      const diff = startX - x;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.goToNext();
        } else {
          this.goToPrevious();
        }
      }
    });
  }
  goToNext() {
    if (this.currentIndex < this.concepts.length - 1) {
      this.showCard(this.currentIndex + 1);
    } else {
      this.finish();
    }
  }
  goToPrevious() {
    if (this.currentIndex > 0) {
      this.showCard(this.currentIndex - 1);
    }
  }
  showCard(index) {
    this.currentIndex = index;
    const card = this.conceptEls[index];
    if (!card || !this.cardsContainer)
      return;
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    this.updateProgress();
  }
  updateProgress() {
    if (!this.progressEl)
      return;
    this.progressEl.textContent = `Concept ${this.currentIndex + 1} of ${this.concepts.length}`;
  }
  finish() {
    const proficiencyMap = {
      courseId: this.courseId,
      scores: { ...this.scores }
    };
    for (const concept of this.concepts) {
      if (!proficiencyMap.scores[concept.id]) {
        proficiencyMap.scores[concept.id] = 3;
      }
    }
    new import_obsidian6.Notice(`Proficiency assessment complete`);
    this.onComplete(proficiencyMap);
    this.close();
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};

// src/stages/stage2-diagnostic.ts
async function runStage2(options) {
  return new Promise((resolve) => {
    const modal = new LikertModal({
      app: options.app,
      concepts: options.concepts.concepts,
      courseId: options.courseId,
      onComplete: (proficiency) => {
        resolve(proficiency);
      },
      onCancel: () => {
        resolve(null);
      }
    });
    modal.open();
  });
}

// src/stages/stage3-curriculum.ts
var import_obsidian8 = require("obsidian");

// src/ui/conflict-modal.ts
var import_obsidian7 = require("obsidian");
var ConflictModal = class extends import_obsidian7.Modal {
  constructor(options) {
    super(options.app);
    this.lockInfo = options.lockInfo;
    this.onCancel = options.onCancel;
    this.onOverride = options.onOverride;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const coverMode = contentEl.offsetWidth < 500;
    contentEl.createEl("h2", { text: "Generation Already In Progress" });
    const message = contentEl.createDiv("conflict-message");
    message.style.marginTop = "16px";
    message.style.lineHeight = "1.6";
    message.createEl("p", {
      text: `Another device is currently generating this curriculum.`
    });
    const deviceInfo = contentEl.createDiv("device-info");
    deviceInfo.style.marginTop = "12px";
    deviceInfo.style.padding = "12px";
    deviceInfo.style.background = "var(--background-secondary)";
    deviceInfo.style.borderRadius = "6px";
    deviceInfo.createEl("p", {
      text: `Device: ${this.lockInfo.deviceName}`
    });
    const startedDate = new Date(this.lockInfo.startedAt);
    deviceInfo.createEl("p", {
      text: `Started: ${startedDate.toLocaleString()}`
    });
    const buttonRow = contentEl.createDiv("button-row");
    buttonRow.style.display = "flex";
    buttonRow.style.flexDirection = coverMode ? "column" : "row";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "24px";
    const cancelButton = new import_obsidian7.ButtonComponent(buttonRow);
    cancelButton.setButtonText("Cancel");
    cancelButton.onClick(() => {
      this.close();
      this.onCancel();
    });
    if (this.onOverride) {
      const overrideButton = new import_obsidian7.ButtonComponent(buttonRow);
      overrideButton.setButtonText("Override (Dangerous)");
      overrideButton.setWarning();
      overrideButton.onClick(() => {
        this.close();
        this.onOverride?.();
      });
    }
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
function showConflictModal(options) {
  new ConflictModal(options).open();
}

// src/stages/stage3-curriculum.ts
async function runStage3(options) {
  new import_obsidian8.Notice("Designing curriculum...");
  try {
    if (options.lockService) {
      const lockState = await options.lockService.isLockedByAnother(options.courseId);
      if (lockState.locked && lockState.info) {
        showConflictModal({
          app: options.app,
          lockInfo: lockState.info,
          onCancel: () => {
            options.onError(new Error("Cancelled: generation in progress on another device"));
          }
        });
        return null;
      }
    }
    const contextResult = await options.contextBuilder.buildContext(options.modelContextLength);
    const prompt = composeStage3Prompt(
      options.taxonomy.selectedIds,
      options.concepts.concepts,
      options.proficiency,
      contextResult.text,
      options.promptTemplate
    );
    const result = await options.openRouter.chat({
      model: options.model,
      messages: [{ role: "user", content: prompt }],
      responseFormat: "json_object",
      temperature: 0.3
    });
    let parsed;
    try {
      parsed = validateCurriculum(JSON.parse(result.content));
    } catch {
      const retryPrompt = `Your previous response failed validation. Return valid JSON only matching the Curriculum schema. ${result.content}`;
      const retryResult = await options.openRouter.chat({
        model: options.model,
        messages: [{ role: "user", content: retryPrompt }],
        responseFormat: "json_object",
        temperature: 0.3
      });
      parsed = validateCurriculum(JSON.parse(retryResult.content));
    }
    const curriculum = {
      courseId: options.courseId,
      title: parsed.title,
      modules: parsed.modules
    };
    new import_obsidian8.Notice(`Curriculum ready: ${curriculum.modules.length} modules`);
    options.onComplete(curriculum);
    return curriculum;
  } catch (error) {
    new import_obsidian8.Notice(`Curriculum design failed: ${error.message}`);
    options.onError(error);
    return null;
  }
}

// src/stages/stage4-generate.ts
var import_obsidian9 = require("obsidian");

// src/writers/frontmatter.ts
function buildFrontmatter(data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      if (value.includes(":") || value.includes('"') || value.includes("'") || value.includes("\n")) {
        lines.push(`${key}: "${escapeYamlString(value)}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => `"${v}"`).join(", ")}]`);
    } else if (value === null) {
      lines.push(`${key}: null`);
    } else if (value === void 0) {
    } else {
      lines.push(`${key}: "${String(value)}"`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
function escapeYamlString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// src/writers/markdown.ts
function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}
function buildLessonFileName(title, existingNames) {
  let base = slugify(title);
  if (!base)
    base = "lesson";
  let name = base;
  let counter = 1;
  while (existingNames.has(name + ".md")) {
    counter++;
    name = `${base}-${counter}`;
  }
  existingNames.add(name + ".md");
  return name + ".md";
}

// src/writers/navigation.ts
function toWikiTarget(filePath) {
  return filePath.replace(/\.md$/i, "");
}
function buildBreadcrumb(courseIndexPath, modulePath, moduleTitle) {
  return `[[${toWikiTarget(courseIndexPath)}|Course Index]] > [[${toWikiTarget(modulePath)}|${moduleTitle}]]
`;
}
function buildPrevNext(prevLesson, nextLesson, courseIndexPath) {
  const parts = ["---"];
  parts.push("\n**Navigation:**\n");
  if (prevLesson) {
    parts.push(`- Previous: [[${toWikiTarget(prevLesson.filePath)}|${prevLesson.title}]]
`);
  }
  if (nextLesson) {
    parts.push(`- Next: [[${toWikiTarget(nextLesson.filePath)}|${nextLesson.title}]]
`);
  } else {
    parts.push(`- Next: [[${toWikiTarget(courseIndexPath)}|Course Index]]
`);
  }
  return parts.join("");
}

// src/writers/moc.ts
function buildMoc(moduleTitle, lessons) {
  const lines = [
    `# ${moduleTitle}`,
    "",
    `This module contains ${lessons.length} lessons.`,
    "",
    "## Lessons",
    ""
  ];
  for (const lesson of lessons) {
    const fileName = lesson.filePath.split("/").pop()?.replace(".md", "") || lesson.title;
    lines.push(`- [[${fileName}|${lesson.title}]]`);
  }
  lines.push("");
  return lines.join("\n");
}
function buildCourseIndex(courseTitle, modules) {
  const lines = [
    `# ${courseTitle}`,
    "",
    `This course contains ${modules.length} modules.`,
    "",
    "## Modules",
    ""
  ];
  for (const mod of modules) {
    const fileName = mod.mocPath.split("/").pop()?.replace(".md", "") || mod.title;
    lines.push(`- [[${fileName}|${mod.title}]] (${mod.lessonCount} lessons)`);
  }
  lines.push("");
  return lines.join("\n");
}

// src/writers/canvas.ts
var NODE_WIDTH = 320;
var NODE_HEIGHT = 200;
var X_STEP = 400;
var Y_STEP = 240;
function generateCanvas(curriculum) {
  const nodes = [];
  const edges = [];
  const lessonToNodeId = /* @__PURE__ */ new Map();
  for (let modIdx = 0; modIdx < curriculum.modules.length; modIdx++) {
    const module2 = curriculum.modules[modIdx];
    const x = modIdx * X_STEP;
    for (let lessonIdx = 0; lessonIdx < module2.lessons.length; lessonIdx++) {
      const lesson = module2.lessons[lessonIdx];
      const y = lessonIdx * Y_STEP;
      const nodeId = `node-${modIdx}-${lessonIdx}`;
      const lessonFileName = slugifyForCanvas(lesson.title);
      const filePath = `4-Curriculum/${slugifyForCanvas(module2.title)}/${lessonFileName}.md`;
      nodes.push({
        id: nodeId,
        type: "file",
        file: filePath,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
      lessonToNodeId.set(lesson.id, { nodeId, x, y });
      for (const prereqId of lesson.prerequisiteLessonIds) {
        const prereq = lessonToNodeId.get(prereqId);
        if (prereq) {
          edges.push({
            id: `edge-${prereq.nodeId}-${nodeId}`,
            from: { id: prereq.nodeId, side: "bottom" },
            to: { id: nodeId, side: "top" }
          });
        }
      }
    }
  }
  const canvas = { nodes, edges };
  return JSON.stringify(canvas, null, 2);
}
function slugifyForCanvas(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
}

// src/stages/stage4-generate.ts
function getDeviceName() {
  const platform = import_obsidian9.Platform.isDesktop ? "desktop" : import_obsidian9.Platform.isMobile ? "mobile" : "unknown";
  return `${platform}-${Date.now()}`;
}
var GenerationCancelledError = class extends Error {
  constructor() {
    super("Generation cancelled");
    this.name = "GenerationCancelledError";
  }
};
var Stage4Runner = class {
  constructor(options) {
    this.abortController = new AbortController();
    this.cancelRequested = false;
    this.lockHeld = false;
    this.lockReleased = false;
    this.options = options;
    this.lessonRecords = this.buildLessonRecords();
    this.progress = this.createInitialProgress();
  }
  async run() {
    const deviceName = getDeviceName();
    const lockAcquired = await this.options.lockService.acquireLock(this.options.courseId, deviceName);
    if (!lockAcquired) {
      const lockInfo = await this.options.lockService.getLockInfo();
      if (lockInfo) {
        showConflictModal({
          app: this.options.app,
          lockInfo,
          onCancel: () => {
            this.options.onError(new Error("Cancelled: generation in progress on another device"));
          }
        });
      } else {
        new import_obsidian9.Notice("Could not acquire lock. Please try again.");
        this.options.onError(new Error("Could not acquire lock"));
      }
      throw new Error("Could not acquire lock");
    }
    this.lockHeld = true;
    try {
      this.throwIfCancelled();
      await this.generateAllLessons();
      this.throwIfCancelled();
      await this.generateMocs();
      this.throwIfCancelled();
      await this.generateCanvas();
      this.throwIfCancelled();
      await this.generateCourseIndex();
      this.progress.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      await this.options.onProgress(this.cloneProgress());
      await this.releaseLockOnce();
      this.options.onComplete();
      return this.progress;
    } catch (error) {
      await this.releaseLockOnce();
      if (!(error instanceof GenerationCancelledError)) {
        this.options.onError(error);
      }
      throw error;
    }
  }
  async cancel() {
    this.cancelRequested = true;
    this.abortController.abort();
    await this.releaseLockOnce();
  }
  buildLessonRecords() {
    const records = [];
    for (const module2 of this.options.curriculum.modules) {
      const moduleSlug = this.slugify(module2.title);
      const existingNames = /* @__PURE__ */ new Set();
      const mocPath = `4-Curriculum/${moduleSlug}/${moduleSlug} MOC.md`;
      for (const lesson of module2.lessons) {
        const fileName = buildLessonFileName(lesson.title, existingNames);
        records.push({
          module: module2,
          moduleSlug,
          mocPath,
          lesson,
          lessonPath: `4-Curriculum/${moduleSlug}/${fileName}`
        });
      }
    }
    return records;
  }
  async generateAllLessons() {
    for (let index = 0; index < this.lessonRecords.length; index++) {
      this.throwIfCancelled();
      const record = this.lessonRecords[index];
      const progressIndex = this.progress.lessons.findIndex((lesson) => lesson.lessonId === record.lesson.id);
      const existingProgress = progressIndex === -1 ? null : this.progress.lessons[progressIndex];
      if (existingProgress?.status === "written") {
        continue;
      }
      const relatedConcepts = this.getRelatedConcepts(record.lesson);
      const sourceRefs = this.collectSourceRefs(relatedConcepts);
      if (progressIndex !== -1) {
        this.progress.lessons[progressIndex] = {
          ...this.progress.lessons[progressIndex],
          status: "writing",
          sourceRefs
        };
        await this.options.onProgress(this.cloneProgress());
      }
      const lessonMarkdown = await this.generateLessonMarkdown(record.lesson, relatedConcepts);
      this.throwIfCancelled();
      const generationMode = this.classifyGenerationMode(sourceRefs);
      const content = this.composeLessonFile(record, lessonMarkdown, sourceRefs, generationMode, index);
      await this.options.writeLesson(record.lessonPath, content);
      this.throwIfCancelled();
      if (progressIndex !== -1) {
        this.progress.lessons[progressIndex] = {
          ...this.progress.lessons[progressIndex],
          filePath: record.lessonPath,
          status: "written",
          sourceRefs,
          error: void 0
        };
        await this.options.onProgress(this.cloneProgress());
      }
    }
  }
  async generateLessonMarkdown(lesson, relatedConcepts) {
    const prompt = composeStage4Prompt(
      lesson,
      relatedConcepts,
      this.options.contextText,
      this.options.promptTemplate
    );
    const result = await this.options.openRouter.chat({
      model: this.options.model,
      messages: [{ role: "user", content: prompt }],
      responseFormat: "text",
      temperature: 0.4,
      signal: this.abortController.signal
    });
    return this.validateLessonMarkdown(lesson, result.content);
  }
  validateLessonMarkdown(lesson, markdown) {
    const trimmed = markdown.trim();
    if (!trimmed) {
      throw new Error(`Stage 4 returned empty content for lesson "${lesson.title}"`);
    }
    if (trimmed.startsWith("---")) {
      throw new Error(`Stage 4 returned frontmatter for lesson "${lesson.title}"`);
    }
    if (!trimmed.startsWith(`# ${lesson.title}`)) {
      throw new Error(`Stage 4 returned an invalid heading for lesson "${lesson.title}"`);
    }
    if (!trimmed.includes("> [!question]")) {
      throw new Error(`Stage 4 lesson "${lesson.title}" is missing the required question callout`);
    }
    const wordCount = trimmed.replace(/^# .+$/m, "").trim().split(/\s+/).filter(Boolean).length;
    const minWords = lesson.condensed ? 120 : 400;
    const maxWords = lesson.condensed ? 250 : 900;
    if (wordCount < minWords || wordCount > maxWords) {
      throw new Error(
        `Stage 4 lesson "${lesson.title}" has ${wordCount} words; expected ${minWords}-${maxWords}`
      );
    }
    return trimmed;
  }
  composeLessonFile(record, markdown, sourceRefs, generationMode, lessonIndex) {
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const frontmatter = buildFrontmatter({
      status: "unread",
      difficulty: record.lesson.difficulty,
      lessonId: record.lesson.id,
      moduleId: record.module.id,
      sourceRefs,
      generated_at: generatedAt,
      generation_mode: generationMode
    });
    const breadcrumb = buildBreadcrumb(
      "4-Curriculum/Course Index.md",
      record.mocPath,
      record.module.title
    ).trimEnd();
    const prevNext = buildPrevNext(
      this.getAdjacentLesson(lessonIndex - 1),
      this.getAdjacentLesson(lessonIndex + 1),
      "Course Index.md"
    ).trim();
    return [frontmatter, breadcrumb, "", markdown, "", prevNext, ""].join("\n");
  }
  getAdjacentLesson(index) {
    if (index < 0 || index >= this.lessonRecords.length) {
      return null;
    }
    const record = this.lessonRecords[index];
    return {
      title: record.lesson.title,
      filePath: record.lessonPath
    };
  }
  async generateMocs() {
    for (const module2 of this.options.curriculum.modules) {
      const moduleSlug = this.slugify(module2.title);
      const mocPath = `4-Curriculum/${moduleSlug}/${moduleSlug} MOC.md`;
      const lessons = this.lessonRecords.filter((record) => record.module.id === module2.id).map((record) => ({
        title: record.lesson.title,
        filePath: record.lessonPath
      }));
      await this.options.writeMoc(mocPath, buildMoc(module2.title, lessons));
    }
  }
  async generateCanvas() {
    const canvasPath = "4-Curriculum/course.canvas";
    await this.options.writeCanvas(canvasPath, generateCanvas(this.options.curriculum));
    this.progress.canvasPath = canvasPath;
  }
  async generateCourseIndex() {
    const indexPath = "4-Curriculum/Course Index.md";
    const modules = this.options.curriculum.modules.map((module2) => {
      const moduleSlug = this.slugify(module2.title);
      return {
        title: module2.title,
        mocPath: `4-Curriculum/${moduleSlug}/${moduleSlug} MOC.md`,
        lessonCount: module2.lessons.length
      };
    });
    await this.options.writeCourseIndex(indexPath, buildCourseIndex(this.options.curriculum.title, modules));
    this.progress.indexPath = indexPath;
  }
  getRelatedConcepts(lesson) {
    return this.options.concepts.filter((concept) => lesson.relatedConceptIds.includes(concept.id));
  }
  collectSourceRefs(concepts) {
    return Array.from(new Set(concepts.flatMap((concept) => concept.sourceRefs))).sort();
  }
  classifyGenerationMode(sourceRefs) {
    if (isKnowledgeOnlyPlaceholder(this.options.contextText)) {
      return "knowledge-only";
    }
    return sourceRefs.length > 0 ? "grounded" : "augmented";
  }
  cloneProgress() {
    return {
      ...this.progress,
      lessons: this.progress.lessons.map((lesson) => ({ ...lesson }))
    };
  }
  fileStem(path) {
    const fileName = path.split("/").pop() || path;
    return fileName.replace(/\.md$/, "");
  }
  slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
  }
  getProgress() {
    return this.cloneProgress();
  }
  createInitialProgress() {
    const initial = this.options.initialProgress;
    const priorLessons = new Map((initial?.lessons ?? []).map((lesson) => [lesson.lessonId, lesson]));
    return {
      courseId: this.options.courseId,
      lessons: this.lessonRecords.map((record) => {
        const prior = priorLessons.get(record.lesson.id);
        return {
          lessonId: record.lesson.id,
          filePath: record.lessonPath,
          status: prior?.status === "written" ? "written" : "pending",
          error: prior?.status === "error" ? prior.error : void 0,
          sourceRefs: prior?.sourceRefs ?? []
        };
      }),
      canvasPath: initial?.canvasPath,
      indexPath: initial?.indexPath,
      startedAt: initial?.startedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      completedAt: initial?.completedAt
    };
  }
  throwIfCancelled() {
    if (this.cancelRequested || this.abortController.signal.aborted) {
      throw new GenerationCancelledError();
    }
  }
  async releaseLockOnce() {
    if (!this.lockHeld || this.lockReleased) {
      return;
    }
    this.lockReleased = true;
    await this.options.lockService.releaseLock();
  }
};

// src/ui/syllabus-editor-view.ts
var SyllabusEditor = class {
  constructor(options) {
    this.modules = [];
    this.container = options.container;
    this.curriculum = JSON.parse(JSON.stringify(options.curriculum));
    this.onSave = options.onSave;
    this.onCancel = options.onCancel;
    this.render();
  }
  render() {
    this.container.empty();
    const header = this.container.createDiv("syllabus-header");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;";
    header.createEl("h2", { text: this.curriculum.title || "Edit Curriculum" });
    const buttonRow = header.createDiv("button-row");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "8px";
    const finalizeBtn = buttonRow.createEl("button", { text: "Finalize" });
    finalizeBtn.style.cssText = `
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 48px;
      display: flex;
      align-items: center;
    `;
    finalizeBtn.addEventListener("click", () => this.handleFinalize());
    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--border-color);
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 48px;
    `;
    cancelBtn.addEventListener("click", () => this.onCancel());
    const modulesContainer = this.container.createDiv("modules-container");
    modulesContainer.style.cssText = "display: flex; flex-direction: column; gap: 24px;";
    for (let i = 0; i < this.curriculum.modules.length; i++) {
      const moduleEl = this.renderModule(this.curriculum.modules[i], i);
      modulesContainer.appendChild(moduleEl);
    }
  }
  renderModule(module2, moduleIndex) {
    const moduleEl = document.createElement("div");
    moduleEl.className = "module";
    moduleEl.style.cssText = `
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      background: var(--background-secondary);
    `;
    const header = moduleEl.createDiv("module-header");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;";
    const titleInput = header.createEl("input", { type: "text", value: module2.title });
    titleInput.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 4px 8px;
      background: transparent;
      color: var(--text);
      flex: 1;
    `;
    titleInput.addEventListener("change", () => {
      module2.title = titleInput.value;
    });
    const deleteModuleBtn = header.createEl("button", { text: "\u2715" });
    deleteModuleBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 18px;
      padding: 8px 12px;
      min-width: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    deleteModuleBtn.addEventListener("click", () => {
      moduleEl.remove();
      this.curriculum.modules.splice(this.curriculum.modules.indexOf(module2), 1);
    });
    const lessonsContainer = moduleEl.createDiv("lessons-container");
    lessonsContainer.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
    for (let j = 0; j < module2.lessons.length; j++) {
      const lessonEl = this.renderLesson(module2.lessons[j], module2);
      lessonsContainer.appendChild(lessonEl);
    }
    const addLessonBtn = lessonsContainer.createEl("button", { text: "+ Add Lesson" });
    addLessonBtn.style.cssText = `
      background: transparent;
      border: 1px dashed var(--border-color);
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      color: var(--text-muted);
      min-height: 48px;
    `;
    addLessonBtn.addEventListener("click", () => {
      const newLesson = {
        id: `lesson-${Date.now()}`,
        title: "New Lesson",
        summary: "",
        prerequisiteLessonIds: [],
        relatedConceptIds: [],
        difficulty: "intro",
        condensed: false
      };
      module2.lessons.push(newLesson);
      const lessonEl = this.renderLesson(newLesson, module2);
      lessonsContainer.insertBefore(lessonEl, addLessonBtn);
    });
    return moduleEl;
  }
  renderLesson(lesson, module2) {
    const lessonEl = document.createElement("div");
    lessonEl.className = "lesson";
    lessonEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--background);
    `;
    const dragHandle = lessonEl.createEl("span", { text: "\u2630" });
    dragHandle.style.cssText = `
      cursor: grab;
      color: var(--text-muted);
      font-size: 14px;
      min-width: 24px;
      min-height: 48px;
      display: flex;
      align-items: center;
    `;
    const checkbox = lessonEl.createEl("input", { type: "checkbox" });
    checkbox.checked = !lesson.condensed;
    checkbox.style.cssText = "width: 18px; height: 18px; cursor: pointer;";
    checkbox.addEventListener("change", () => {
      lesson.condensed = !checkbox.checked;
    });
    const titleInput = lessonEl.createEl("input", { type: "text", value: lesson.title });
    titleInput.style.cssText = `
      flex: 1;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 4px 8px;
      background: transparent;
      color: var(--text);
      min-height: 48px;
    `;
    titleInput.addEventListener("change", () => {
      lesson.title = titleInput.value;
    });
    const difficultyChip = lessonEl.createEl("span", { text: lesson.difficulty });
    difficultyChip.style.cssText = `
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      text-transform: capitalize;
    `;
    const deleteBtn = lessonEl.createEl("button", { text: "\u2715" });
    deleteBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      padding: 8px 12px;
      min-width: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    deleteBtn.addEventListener("click", () => {
      lessonEl.remove();
      module2.lessons.splice(module2.lessons.indexOf(lesson), 1);
    });
    return lessonEl;
  }
  handleFinalize() {
    this.onSave(this.curriculum);
  }
};
function createSyllabusEditor(options) {
  return new SyllabusEditor(options);
}

// src/ui/progress-view.ts
var ProgressView = class {
  constructor(options) {
    this.progressBar = null;
    this.statusEl = null;
    this.container = options.container;
    this.progress = options.progress;
    this.onCancel = options.onCancel;
    this.render();
  }
  render() {
    this.container.empty();
    const coverMode = isCoverMode(document.body.offsetWidth);
    this.container.createEl("h2", { text: "Generating Curriculum" });
    const totalLessons = this.progress.lessons.length;
    if (totalLessons === 0) {
      this.renderLoadingState(coverMode);
      return;
    }
    if (this.hasError()) {
      this.renderErrorState();
      return;
    }
    this.renderProgressContent();
  }
  renderLoadingState(coverMode) {
    const loadingEl = this.container.createDiv("loading-state");
    loadingEl.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: ${coverMode ? "32px 16px" : "48px 24px"};
      text-align: center;
      min-height: 200px;
    `;
    const spinner = loadingEl.createEl("span", { text: "\u27F3" });
    spinner.style.cssText = `
      font-size: 32px;
      animation: spin 1s linear infinite;
      display: inline-block;
    `;
    const loadingText = loadingEl.createEl("p", { text: "Preparing your curriculum..." });
    loadingText.style.cssText = `
      color: var(--text-muted);
      margin: 16px 0 0 0;
      font-size: 14px;
    `;
    const cancelBtn = this.container.createEl("button", { text: "Cancel Generation" });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--text-error);
      color: var(--text-error);
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 24px;
      min-height: 48px;
      min-width: 160px;
      font-size: 14px;
    `;
    cancelBtn.addEventListener("click", () => this.onCancel());
    this.injectSpinAnimation();
  }
  renderErrorState() {
    const errorEl = this.container.createDiv("error-state");
    errorEl.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
      min-height: 200px;
    `;
    const errorIcon = errorEl.createEl("span", { text: "\u26A0" });
    errorIcon.style.cssText = `
      font-size: 48px;
      color: var(--text-error);
      margin-bottom: 16px;
    `;
    const errorTitle = errorEl.createEl("h3", { text: "Generation Failed" });
    errorTitle.style.cssText = `
      color: var(--text-error);
      margin: 0 0 8px 0;
    `;
    const errorMessage = errorEl.createEl("p", { text: this.getErrorMessage() });
    errorMessage.style.cssText = `
      color: var(--text-muted);
      margin: 0 0 24px 0;
      font-size: 14px;
      max-width: 400px;
    `;
    const retryBtn = this.container.createEl("button", { text: "Retry" });
    retryBtn.style.cssText = `
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 48px;
      min-width: 120px;
      font-size: 14px;
    `;
    retryBtn.addEventListener("click", () => {
      this.container.empty();
      this.render();
    });
    const cancelBtn = this.container.createEl("button", { text: "Cancel" });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 8px;
      min-height: 48px;
      min-width: 120px;
      font-size: 14px;
    `;
    cancelBtn.addEventListener("click", () => this.onCancel());
  }
  renderProgressContent() {
    this.statusEl = this.container.createDiv("generation-status");
    this.statusEl.style.marginBottom = "16px";
    const totalLessons = this.progress.lessons.length;
    const writtenLessons = this.progress.lessons.filter((l) => l.status === "written").length;
    const currentLesson = this.progress.lessons.find((l) => l.status === "writing");
    this.statusEl.textContent = `Generating ${writtenLessons + 1} of ${totalLessons}...`;
    this.progressBar = this.container.createDiv("progress-bar");
    this.progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: var(--background-modifier-border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    `;
    const fill = this.progressBar.createDiv("progress-fill");
    fill.style.cssText = `
      height: 100%;
      background: var(--interactive-accent);
      width: ${writtenLessons / totalLessons * 100}%;
      transition: width 0.3s ease;
    `;
    const lessonsList = this.container.createDiv("lessons-list");
    lessonsList.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    `;
    for (const lesson of this.progress.lessons) {
      const item = lessonsList.createDiv("lesson-item");
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid var(--border-color);
        min-height: 48px;
      `;
      const statusIcon = item.createEl("span");
      switch (lesson.status) {
        case "written":
          statusIcon.textContent = "\u2713";
          statusIcon.style.color = "var(--text-success)";
          break;
        case "writing":
          statusIcon.textContent = "\u27F3";
          statusIcon.style.color = "var(--interactive-accent)";
          break;
        case "error":
          statusIcon.textContent = "\u2717";
          statusIcon.style.color = "var(--text-error)";
          break;
        default:
          statusIcon.textContent = "\u25CB";
          statusIcon.style.color = "var(--text-muted)";
      }
      const title = item.createEl("span", { text: lesson.lessonId });
      title.style.flex = "1";
      if (lesson.status === "error" && lesson.error) {
        const errorMsg = item.createEl("span", { text: lesson.error });
        errorMsg.style.color = "var(--text-error)";
        errorMsg.style.fontSize = "12px";
      }
    }
    const cancelBtn = this.container.createEl("button", { text: "Cancel Generation" });
    cancelBtn.style.cssText = `
      background: transparent;
      border: 1px solid var(--text-error);
      color: var(--text-error);
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 16px;
      min-height: 48px;
      min-width: 160px;
      font-size: 14px;
    `;
    cancelBtn.addEventListener("click", () => this.onCancel());
  }
  hasError() {
    return this.progress.lessons.some((l) => l.status === "error");
  }
  getErrorMessage() {
    const errorLesson = this.progress.lessons.find((l) => l.status === "error");
    return errorLesson?.error || "An unexpected error occurred during curriculum generation.";
  }
  injectSpinAnimation() {
    if (document.querySelector("#curricula-spin-animation"))
      return;
    const style = document.createElement("style");
    style.id = "curricula-spin-animation";
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  update(progress) {
    this.progress = progress;
    if (this.progressBar) {
      const totalLessons = this.progress.lessons.length;
      if (totalLessons > 0) {
        const writtenLessons = this.progress.lessons.filter((l) => l.status === "written").length;
        const fill = this.progressBar.querySelector(".progress-fill");
        if (fill) {
          fill.style.width = `${writtenLessons / totalLessons * 100}%`;
        }
      }
    }
    if (this.statusEl) {
      const totalLessons = this.progress.lessons.length;
      if (totalLessons > 0) {
        const writtenLessons = this.progress.lessons.filter((l) => l.status === "written").length;
        this.statusEl.textContent = `Generating ${writtenLessons + 1} of ${totalLessons}...`;
      }
    }
  }
};
function createProgressView(options) {
  return new ProgressView(options);
}

// src/ui/resume-modal.ts
var import_obsidian10 = require("obsidian");
var ResumePromptModal = class extends import_obsidian10.Modal {
  constructor(app, options) {
    super(app);
    this.courseLabel = options.courseLabel;
    this.stageLabel = options.stageLabel;
    this.onResume = options.onResume;
    this.onDismiss = options.onDismiss;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Resume course" });
    contentEl.createEl("p", {
      text: `Resume ${this.courseLabel} from ${this.stageLabel}?`
    });
    const buttonRow = contentEl.createDiv();
    buttonRow.style.cssText = "display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;";
    const dismissButton = new import_obsidian10.ButtonComponent(buttonRow);
    dismissButton.setButtonText("Later");
    dismissButton.onClick(() => {
      this.close();
      this.onDismiss();
    });
    const resumeButton = new import_obsidian10.ButtonComponent(buttonRow);
    resumeButton.setButtonText("Resume");
    resumeButton.setCta();
    resumeButton.onClick(() => {
      this.close();
      this.onResume();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/plugin.ts
var DEFAULT_MODEL = "anthropic/claude-3.5-haiku";
var DEFAULT_MODEL_CONTEXT_LENGTH = 32e3;
var CurriculaPlugin = class extends import_obsidian11.Plugin {
  async onLoad() {
    this.settings = await loadSettings(this);
    this.settingsTab = new CurriculaSettingsTab(this.app, this, this.settings);
    this.addSettingTab(this.settingsTab);
    this.openRouter = new OpenRouterService({
      apiKey: this.settings.openRouterApiKey,
      baseUrl: OPENROUTER_BASE_URL
    });
    this.openRouter.hydrateModelsCache(this.settings._modelsCache);
    this.cacheService = new CacheService(this.app.vault.adapter, this.manifest.dir || "");
    this.lockService = new LockService(this.app.vault, this.app.vault.adapter);
    this.contextBuilder = new ContextBuilder(this.app.vault);
    this.addCommand({
      id: "curricula:start-new-course",
      name: "Start New Course",
      callback: () => {
        void this.startNewCourse();
      }
    });
    this.addRibbonIcon("graduation-cap", "Start New Course", () => {
      void this.startNewCourse();
    });
    await this.checkForInProgressCourses();
  }
  async applySettings(settings) {
    this.settings = {
      ...settings,
      promptOverrides: {
        ...settings.promptOverrides
      }
    };
    if (this.openRouter) {
      this.openRouter.updateConfig({
        apiKey: this.settings.openRouterApiKey,
        baseUrl: OPENROUTER_BASE_URL
      });
      this.openRouter.hydrateModelsCache(this.settings._modelsCache);
    }
    await this.saveData(this.settings);
  }
  async startNewCourse() {
    const courseId = this.createCourseId();
    const cache = this.createInitialCache(courseId);
    try {
      await this.cacheService.writeMeta(courseId, cache.meta);
      const taxonomy = await runStage0(
        this.app,
        this.openRouter,
        this.contextBuilder,
        courseId,
        {
          model: this.getActiveModel(),
          promptTemplate: this.getPromptTemplate("stage0")
        }
      );
      if (!taxonomy) {
        return;
      }
      cache.meta.seedTopic = taxonomy.root.title;
      await this.persistStage(cache, 0, taxonomy);
      const concepts = await this.runStage1Flow(courseId, taxonomy);
      if (!concepts) {
        return;
      }
      await this.persistStage(cache, 1, concepts);
      const proficiency = await runStage2({
        app: this.app,
        concepts,
        courseId,
        onComplete: () => void 0,
        onError: () => void 0
      });
      if (!proficiency) {
        return;
      }
      await this.persistStage(cache, 2, proficiency);
      const draftCurriculum = await this.runStage3Flow(courseId, taxonomy, concepts, proficiency);
      if (!draftCurriculum) {
        return;
      }
      const curriculum = await this.openSyllabusEditor(draftCurriculum);
      if (!curriculum) {
        return;
      }
      await this.persistStage(cache, 3, curriculum);
      const progress = await this.runStage4Flow(cache, courseId, curriculum, concepts);
      if (!progress) {
        return;
      }
      await this.persistStage(cache, 4, progress);
      new import_obsidian11.Notice(`Course ready: ${curriculum.title}`);
    } catch (error) {
      new import_obsidian11.Notice(`Course generation failed: ${error.message}`);
    }
  }
  createInitialCache(courseId) {
    const meta = {
      courseId,
      seedTopic: "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastStageCompleted: null,
      modelUsed: this.getActiveModel()
    };
    return { meta };
  }
  getActiveModel() {
    return this.settings.defaultModel || DEFAULT_MODEL;
  }
  getPromptTemplate(stage) {
    const override = this.settings.promptOverrides[stage]?.trim();
    return override ? override : void 0;
  }
  async persistStage(cache, stage, data) {
    cache.meta.lastStageCompleted = stage;
    if (stage === 0) {
      cache.stage0 = data;
    } else if (stage === 1) {
      cache.stage1 = data;
    } else if (stage === 2) {
      cache.stage2 = data;
    } else if (stage === 3) {
      cache.stage3 = data;
    } else {
      cache.stage4 = data;
    }
    await this.cacheService.writeMeta(cache.meta.courseId, cache.meta);
    await this.cacheService.writeStage(cache.meta.courseId, stage, data, cache);
  }
  async runStage1Flow(courseId, taxonomy) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };
      void runStage1({
        app: this.app,
        openRouter: this.openRouter,
        contextBuilder: this.contextBuilder,
        taxonomy,
        courseId,
        model: this.getActiveModel(),
        modelContextLength: DEFAULT_MODEL_CONTEXT_LENGTH,
        promptTemplate: this.getPromptTemplate("stage1"),
        onComplete: (concepts) => finish(concepts),
        onError: () => finish(null)
      }).then((result) => {
        if (result) {
          finish(result);
        }
      }).catch(() => {
        finish(null);
      });
    });
  }
  async runStage3Flow(courseId, taxonomy, concepts, proficiency) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };
      void runStage3({
        app: this.app,
        openRouter: this.openRouter,
        contextBuilder: this.contextBuilder,
        lockService: this.lockService,
        taxonomy,
        concepts,
        proficiency,
        courseId,
        model: this.getActiveModel(),
        modelContextLength: DEFAULT_MODEL_CONTEXT_LENGTH,
        promptTemplate: this.getPromptTemplate("stage3"),
        onComplete: (curriculum) => finish(curriculum),
        onError: () => finish(null)
      }).then((result) => {
        if (result) {
          finish(result);
        }
      }).catch(() => {
        finish(null);
      });
    });
  }
  async openSyllabusEditor(curriculum) {
    return new Promise((resolve) => {
      let settled = false;
      const modal = new import_obsidian11.Modal(this.app);
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        modal.close();
        resolve(result);
      };
      modal.onOpen = () => {
        createSyllabusEditor({
          container: modal.contentEl,
          curriculum,
          onSave: (updatedCurriculum) => finish(updatedCurriculum),
          onCancel: () => finish(null)
        });
      };
      modal.onClose = () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      };
      modal.open();
    });
  }
  async runStage4Flow(cache, courseId, curriculum, concepts, initialProgress) {
    const context = await this.contextBuilder.buildContext(DEFAULT_MODEL_CONTEXT_LENGTH);
    let runner = null;
    const modal = new import_obsidian11.Modal(this.app);
    const closeAfterCancel = async () => {
      if (!runner) {
        modal.close();
        return;
      }
      await runner.cancel();
      modal.close();
    };
    runner = new Stage4Runner({
      app: this.app,
      openRouter: this.openRouter,
      courseId,
      curriculum,
      concepts: concepts.concepts,
      contextText: context.text,
      model: this.getActiveModel(),
      promptTemplate: this.getPromptTemplate("stage4"),
      lockService: this.lockService,
      initialProgress,
      writeLesson: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      writeMoc: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      writeCanvas: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      writeCourseIndex: async (filePath, content) => {
        await this.writeVaultFile(filePath, content);
      },
      onProgress: async (nextProgress) => {
        view.update(nextProgress);
        await this.persistStage(cache, 4, nextProgress);
      },
      onComplete: () => {
        modal.close();
      },
      onError: (error) => {
        new import_obsidian11.Notice(`Generation failed: ${error.message}`);
      }
    });
    let view = createProgressView({
      container: modal.contentEl,
      progress: runner.getProgress(),
      onCancel: () => {
        void closeAfterCancel();
      }
    });
    modal.onOpen = () => {
      view = createProgressView({
        container: modal.contentEl,
        progress: runner?.getProgress() ?? this.createInitialProgress(courseId, curriculum),
        onCancel: () => {
          void closeAfterCancel();
        }
      });
    };
    modal.open();
    try {
      const progress = await runner.run();
      modal.close();
      return progress;
    } catch (error) {
      modal.close();
      if (error instanceof GenerationCancelledError) {
        return null;
      }
      throw error;
    }
  }
  createInitialProgress(courseId, curriculum) {
    return {
      courseId,
      lessons: curriculum.modules.flatMap(
        (module2) => module2.lessons.map((lesson) => ({
          lessonId: lesson.id,
          filePath: "",
          status: "pending",
          sourceRefs: []
        }))
      ),
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async writeVaultFile(path, content) {
    await this.ensureFolder(path.split("/").slice(0, -1));
    const tmpPath = `${path}.tmp`;
    await this.app.vault.adapter.write(tmpPath, content);
    await this.app.vault.adapter.rename(tmpPath, path);
  }
  async ensureFolder(parts) {
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      try {
        await this.app.vault.adapter.mkdir(current);
      } catch {
      }
    }
  }
  createCourseId() {
    return `course-${Date.now()}`;
  }
  async checkForInProgressCourses() {
    try {
      const courseIds = await this.cacheService.getCourseIds();
      for (const courseId of courseIds) {
        const resumeInfo = await this.cacheService.resumeFrom(courseId);
        if (resumeInfo) {
          const shouldResume = await this.promptResumeCourse(resumeInfo.cache.meta, resumeInfo.nextStage);
          if (shouldResume) {
            await this.resumeCourse(resumeInfo);
            break;
          }
        }
      }
    } catch {
    }
  }
  async promptResumeCourse(meta, nextStage) {
    return new Promise((resolve) => {
      let settled = false;
      const modal = new ResumePromptModal(this.app, {
        courseLabel: meta.seedTopic || meta.courseId,
        stageLabel: this.getStageLabel(nextStage),
        onResume: () => {
          settled = true;
          resolve(true);
        },
        onDismiss: () => {
          settled = true;
          resolve(false);
        }
      });
      modal.onClose = () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };
      modal.open();
    });
  }
  getStageLabel(stage) {
    const stageNames = {
      0: "Stage 0: Topic Explorer",
      1: "Stage 1: Concept Extraction",
      2: "Stage 2: Diagnostic",
      3: "Stage 3: Curriculum Design",
      4: "Stage 4: Content Generation"
    };
    return stageNames[stage];
  }
  async resumeCourse(resumeInfo) {
    const { nextStage, cache } = resumeInfo;
    const courseId = cache.meta.courseId;
    if (nextStage === 0 || !cache.stage0) {
      new import_obsidian11.Notice(`Cannot resume ${courseId}: Stage 0 input was never completed.`);
      return;
    }
    let concepts = cache.stage1 ?? null;
    if (nextStage <= 1 || !concepts) {
      concepts = await this.runStage1Flow(courseId, cache.stage0);
      if (!concepts) {
        return;
      }
      await this.persistStage(cache, 1, concepts);
    }
    let proficiency = cache.stage2 ?? null;
    if (nextStage <= 2 || !proficiency) {
      proficiency = await runStage2({
        app: this.app,
        concepts,
        courseId,
        onComplete: () => void 0,
        onError: () => void 0
      });
      if (!proficiency) {
        return;
      }
      await this.persistStage(cache, 2, proficiency);
    }
    let curriculum = cache.stage3 ?? null;
    if (nextStage <= 3 || !curriculum) {
      const draftCurriculum = await this.runStage3Flow(courseId, cache.stage0, concepts, proficiency);
      if (!draftCurriculum) {
        return;
      }
      curriculum = await this.openSyllabusEditor(draftCurriculum);
      if (!curriculum) {
        return;
      }
      await this.persistStage(cache, 3, curriculum);
    }
    const progress = await this.runStage4Flow(cache, courseId, curriculum, concepts, cache.stage4);
    if (!progress) {
      return;
    }
    await this.persistStage(cache, 4, progress);
    new import_obsidian11.Notice(`Course ready: ${curriculum.title}`);
  }
};

// main.ts
module.exports = new CurriculaPlugin();
