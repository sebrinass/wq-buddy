/**
 * WQBuddy OpenClaw Plugin Entry
 *
 * Registers 11 tools for WorldQuant BRAIN Alpha mining workflow:
 * - alphaBatchSubmit: Batch backtest Alpha expressions
 * - searchFields: Search BRAIN data fields
 * - analyzeField: Analyze field characteristics
 * - alphaStats: Backtest statistics report
 * - updateSubmitStatus: Update Alpha submission status
 * - updateCorrelation: Update Alpha correlation values
 * - checkSubmission: Check Alpha IS checks before submission
 * - submitAlpha: Submit Alpha to BRAIN platform
 * - getAlphaCorrelations: Get Alpha correlation data
 * - listAlphas: List user's Alphas
 * - getUserInfo: Get current user info
 */

import { Type } from "@sinclair/typebox";
import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { alphaBatchSubmit, formatResults, alphaStats } from "./tools.js";
import { searchFields, formatSearchResults } from "./search.js";
import { analyzeField, formatAnalysisResult } from "./analyze-field.js";
import { checkSubmission, formatCheckResult, getAlphaCorrelations, formatCorrelationResult } from "./alpha-check.js";
import { submitAlpha, formatSubmitResult } from "./alpha-submit.js";
import { listAlphas, formatAlphaList } from "./alpha-list.js";
import { getUserInfo, formatUserInfo } from "./user-info.js";
import { getDatabase } from "./db/index.js";
import { loadConfig, getDefaultSettings } from "./config.js";
import { Authenticator } from "./auth.js";

// ── 辅助函数：获取认证session ──────────────────────────────────

async function getAuthSession(): Promise<{ session: any; cookie: string }> {
  const config = loadConfig();
  if (!config) {
    throw new Error('配置文件加载失败');
  }

  const creds = config.credentials;
  if (!creds.username || !creds.password) {
    throw new Error('请在 config.json 中配置账号密码');
  }

  const cached = await Authenticator.getSessionWithCookie(creds.username);
  if (cached) {
    return cached;
  }

  return await Authenticator.loginWithCookie(creds.username, creds.password);
}

// ── Tool Schemas ──────────────────────────────────────────────

const AlphaBatchSubmitSchema = Type.Object(
  {
    expressions: Type.Array(Type.String(), {
      description: "Alpha表达式列表，每条为完整的alpha表达式",
    }),
    concurrency: Type.Optional(
      Type.Number({
        description: "并发数，范围1-3，默认1",
        minimum: 1,
        maximum: 3,
      }),
    ),
    neutralization: Type.Optional(
      Type.String({
        description: "中和方式，覆盖config.json默认值。可选: NONE, MARKET, INDUSTRY, SUBINDUSTRY",
        enum: ["NONE", "MARKET", "INDUSTRY", "SUBINDUSTRY"],
      }),
    ),
    delay: Type.Optional(
      Type.Number({
        description: "延迟天数，覆盖config.json默认值",
        minimum: 1,
      }),
    ),
    decay: Type.Optional(
      Type.Number({
        description: "衰减天数，覆盖config.json默认值",
        minimum: 0,
      }),
    ),
    universe: Type.Optional(
      Type.String({
        description: "股票池，覆盖config.json默认值。如: TOP3000, TOP2000, TOP1000",
      }),
    ),
    region: Type.Optional(
      Type.String({
        description: "区域，覆盖config.json默认值。如: USA, CHN, ASI",
      }),
    ),
  },
  { additionalProperties: false },
);

const SearchFieldsSchema = Type.Object(
  {
    query: Type.String({
      description: "搜索关键词，如 'earnings', 'cash flow'",
    }),
    dataset: Type.Optional(
      Type.String({
        description: "限定数据集ID，如 fundamental6, pv1, scl12",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "返回结果数量上限，默认50",
        minimum: 1,
        maximum: 500,
      }),
    ),
  },
  { additionalProperties: false },
);

const AnalyzeFieldSchema = Type.Object(
  {
    fieldName: Type.String({
      description: "要分析的字段名，如 fnd2_ebitdm, volume",
    }),
    save: Type.Optional(
      Type.Boolean({
        description: "是否保存分析结果到数据库，默认true",
      }),
    ),
  },
  { additionalProperties: false },
);

const AlphaStatsSchema = Type.Object(
  {
    status: Type.Optional(
      Type.String({
        description: "按状态过滤，如 success, failed",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "统计最近N条记录，默认100",
        minimum: 1,
      }),
    ),
  },
  { additionalProperties: false },
);

const UpdateSubmitStatusSchema = Type.Object(
  {
    id: Type.Number({
      description: "Alpha记录ID",
    }),
    status: Type.String({
      description: "新状态: 已通过 / 提交失败",
      enum: ["已通过", "提交失败"],
    }),
    reason: Type.Optional(
      Type.String({
        description: "失败原因（提交失败时填写）",
      }),
    ),
  },
  { additionalProperties: false },
);

const UpdateCorrelationSchema = Type.Object(
  {
    id: Type.Number({
      description: "Alpha记录ID",
    }),
    correlationMax: Type.Optional(
      Type.Number({
        description: "Self Correlation最大值 (0-1)",
        minimum: 0,
        maximum: 1,
      }),
    ),
    correlationMin: Type.Optional(
      Type.Number({
        description: "Self Correlation最小值 (0-1)",
        minimum: 0,
        maximum: 1,
      }),
    ),
  },
  { additionalProperties: false },
);

const CheckSubmissionSchema = Type.Object(
  {
    alphaId: Type.String({
      description: "BRAIN平台的Alpha ID",
    }),
  },
  { additionalProperties: false },
);

const SubmitAlphaSchema = Type.Object(
  {
    alphaId: Type.String({
      description: "BRAIN平台的Alpha ID",
    }),
    confirmed: Type.Boolean({
      description: "用户是否已确认提交，必须为true才执行",
    }),
  },
  { additionalProperties: false },
);

const GetAlphaCorrelationsSchema = Type.Object(
  {
    alphaId: Type.String({
      description: "BRAIN平台的Alpha ID",
    }),
  },
  { additionalProperties: false },
);

const ListAlphasSchema = Type.Object(
  {
    status: Type.Optional(
      Type.String({
        description: "筛选状态",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "返回数量，默认20",
        minimum: 1,
        maximum: 100,
      }),
    ),
    offset: Type.Optional(
      Type.Number({
        description: "分页偏移，默认0",
        minimum: 0,
      }),
    ),
  },
  { additionalProperties: false },
);

const GetUserInfoSchema = Type.Object(
  {},
  { additionalProperties: false },
);

// ── Tool Definitions ──────────────────────────────────────────

const alphaBatchSubmitTool: AnyAgentTool = {
  name: "alphaBatchSubmit",
  label: "Alpha批量回测",
  description:
    "批量提交Alpha表达式进行回测。返回每个表达式的回测结果，包括Sharpe、换手率、保证金、IS检查等指标。" +
    "回测前必须向用户展示确认单（表达式列表、配置、并发数），等待用户确认后再执行。" +
    "支持通过参数覆盖config.json中的默认设置（neutralization/delay/decay/universe/region），覆盖仅在内存中生效，不修改配置文件。",
  parameters: AlphaBatchSubmitSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const expressions = rawParams.expressions as string[];
    const concurrency = rawParams.concurrency as number | undefined;
    const neutralization = rawParams.neutralization as string | undefined;
    const delay = rawParams.delay as number | undefined;
    const decay = rawParams.decay as number | undefined;
    const universe = rawParams.universe as string | undefined;
    const region = rawParams.region as string | undefined;

    if (!expressions || expressions.length === 0) {
      throw new Error("表达式列表不能为空");
    }

    // 配置覆盖改为内存方式：直接构建settingsOverrides传给alphaBatchSubmit
    const settingsOverrides: Record<string, unknown> = {};
    if (neutralization) settingsOverrides.neutralization = neutralization;
    if (delay !== undefined) settingsOverrides.delay = delay;
    if (decay !== undefined) settingsOverrides.decay = decay;
    if (universe) settingsOverrides.universe = universe;
    if (region) settingsOverrides.region = region;

    const result = await alphaBatchSubmit({
      expressions,
      concurrency,
      settingsOverrides: Object.keys(settingsOverrides).length > 0 ? settingsOverrides : undefined
    });
    const text = formatResults(result.results);
    return { content: [{ type: "text" as const, text }] };
  },
};

const searchFieldsTool: AnyAgentTool = {
  name: "searchFields",
  label: "搜索BRAIN字段",
  description:
    "搜索WorldQuant BRAIN平台的数据字段。支持按关键词搜索和按数据集筛选。" +
    "返回字段ID、名称和描述。用于发现可用的数据字段来构建Alpha表达式。" +
    "搜索结果会缓存到本地数据库，下次搜索时优先查询本地缓存。" +
    "认证由工具内部自动处理（Cookie认证，缓存4小时），无需手动干预。",
  parameters: SearchFieldsSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const query = rawParams.query as string;
    const dataset = rawParams.dataset as string | undefined;
    const limit = rawParams.limit as number | undefined;

    // 先查本地缓存
    try {
      const db = await getDatabase();
      const cachedFields = await db.getDataFields(dataset);
      if (cachedFields.length > 0) {
        // 按关键词过滤缓存
        const keyword = query.toLowerCase();
        const filtered = cachedFields.filter(f =>
          f.field_id.toLowerCase().includes(keyword) ||
          f.name.toLowerCase().includes(keyword) ||
          (f.description && f.description.toLowerCase().includes(keyword))
        );
        if (filtered.length > 0) {
          const text = formatSearchResults({
            fields: filtered.map(f => ({
              id: f.field_id,
              name: f.name,
              description: f.description || '',
              type: f.data_type || '',
              datasetId: f.dataset_id || ''
            })),
            totalCount: filtered.length,
            searchKeyword: query,
            datasetId: dataset
          });
          return { content: [{ type: "text" as const, text }] };
        }
      }
    } catch (e) {
      // 缓存查询失败，继续走API
    }

    const result = await searchFields(query, {
      datasetId: dataset,
      limit,
    });

    // 搜索完成后缓存结果到数据库
    try {
      const db = await getDatabase();
      const fieldsToCache = result.fields.map(f => ({
        field_id: f.id,
        name: f.name || '',
        description: f.description || '',
        dataset_id: f.datasetId || '',
        data_type: f.type || '',
        region: 'USA',
        fetched_at: new Date().toISOString()
      }));
      await db.saveDataFields(fieldsToCache);
    } catch (e) {
      // 缓存失败不影响返回
    }

    const text = formatSearchResults(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

const analyzeFieldTool: AnyAgentTool = {
  name: "analyzeField",
  label: "字段分析",
  description:
    "对指定数据字段执行6项标准测试分析：覆盖率、非零覆盖率、更新频率、数据范围、中位数、数据分布。" +
    "分析时自动使用Neutralization=None和Decay=0以确保看到原始数据特性。" +
    "结果可保存到数据库供后续参考。用于在构建Alpha表达式前了解字段的数据特征。",
  parameters: AnalyzeFieldSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const fieldName = rawParams.fieldName as string;
    const save = rawParams.save !== false; // default true

    const result = await analyzeField(fieldName, save);
    const text = formatAnalysisResult(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

const alphaStatsTool: AnyAgentTool = {
  name: "alphaStats",
  label: "回测统计",
  description:
    "获取Alpha回测统计报告，包括总览（成功/失败/可提交数）、Sharpe/Turnover/Fitness/Returns/Drawdown分布、" +
    "按字段或状态分组统计。用于了解整体挖掘进展和发现优化方向。",
  parameters: AlphaStatsSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const status = rawParams.status as string | undefined;
    const limit = rawParams.limit as number | undefined;

    const text = await alphaStats({
      statusFilter: status,
      limit,
    });

    return { content: [{ type: "text" as const, text }] };
  },
};

const updateSubmitStatusTool: AnyAgentTool = {
  name: "updateSubmitStatus",
  label: "更新提交状态",
  description:
    "更新Alpha记录的提交状态。当用户在BRAIN平台确认提交结果后使用。" +
    "状态只能从'可提交(待查)'更新为'已通过'或'提交失败'。" +
    "禁止自动将'可提交(待查)'改为'已通过'，必须等用户确认平台结果后再操作。",
  parameters: UpdateSubmitStatusSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const id = rawParams.id as number;
    const status = rawParams.status as string;
    const reason = rawParams.reason as string | undefined;

    const db = await getDatabase();
    await db.updateSubmitStatus(id, status, reason);

    const text = `已更新Alpha #${id}的提交状态为: ${status}${reason ? ` (原因: ${reason})` : ""}`;
    return { content: [{ type: "text" as const, text }] };
  },
};

const updateCorrelationTool: AnyAgentTool = {
  name: "updateCorrelation",
  label: "更新相关性",
  description:
    "更新Alpha记录的Self Correlation数值。当用户在BRAIN平台查看到相关性数据后使用。" +
    "禁止猜测或编造correlation数值，必须由用户提供真实数据。" +
    "可以只更新Max或Min其中一个，另一个保持不变。",
  parameters: UpdateCorrelationSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const id = rawParams.id as number;
    const correlationMax = rawParams.correlationMax as number | undefined;
    const correlationMin = rawParams.correlationMin as number | undefined;

    if (correlationMax === undefined && correlationMin === undefined) {
      throw new Error("至少需要提供correlationMax或correlationMin");
    }

    const db = await getDatabase();

    // If only one value is provided, read the current record to preserve the other
    let max = correlationMax;
    let min = correlationMin;

    if (max === undefined || min === undefined) {
      const record = await db.getAlpha(id);
      if (!record) {
        throw new Error(`Alpha记录 #${id} 不存在`);
      }
      max = max ?? record.correlationMax ?? 0;
      min = min ?? record.correlationMin ?? 0;
    }

    await db.updateCorrelation(id, max, min);

    const text = `已更新Alpha #${id}的相关性: Max=${max}, Min=${min}`;
    return { content: [{ type: "text" as const, text }] };
  },
};

// ── 新增5个工具 ──────────────────────────────────────────────

const checkSubmissionTool: AnyAgentTool = {
  name: "checkSubmission",
  label: "提交前检查",
  description:
    "检查Alpha的IS Checks是否全部通过，判断是否可以提交。" +
    "返回每项检查的PASS/FAIL状态，以及SELF_CORRELATION的具体值。" +
    "综合判断：全部PASS则可提交，有FAIL项则不可提交。",
  parameters: CheckSubmissionSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const alphaId = rawParams.alphaId as string;

    const { session, cookie } = await getAuthSession();
    const result = await checkSubmission(alphaId, session, cookie);
    const text = formatCheckResult(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

const submitAlphaTool: AnyAgentTool = {
  name: "submitAlpha",
  label: "正式提交Alpha",
  description:
    "将Alpha正式提交到BRAIN平台。必须用户确认后才能执行（confirmed参数必须为true）。" +
    "提交后会自动轮询等待结果，成功后更新数据库提交状态。" +
    "⚠️ 提交是不可逆操作，请确保用户已充分了解并确认。",
  parameters: SubmitAlphaSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const alphaId = rawParams.alphaId as string;
    const confirmed = rawParams.confirmed as boolean;

    if (!confirmed) {
      const text = "❌ 必须用户确认后才能提交。请将confirmed参数设为true。";
      return { content: [{ type: "text" as const, text }] };
    }

    const { session, cookie } = await getAuthSession();
    const db = await getDatabase();
    const result = await submitAlpha(alphaId, confirmed, session, cookie, db);
    const text = formatSubmitResult(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

const getAlphaCorrelationsTool: AnyAgentTool = {
  name: "getAlphaCorrelations",
  label: "查询Alpha相关性",
  description:
    "查询Alpha的Self Correlation数据（Maximum和Minimum相关性）。" +
    "查询结果会自动更新到本地数据库。" +
    "用于评估Alpha与已有Alpha的相关性，判断是否值得提交。",
  parameters: GetAlphaCorrelationsSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const alphaId = rawParams.alphaId as string;

    const { session, cookie } = await getAuthSession();
    const db = await getDatabase();
    const result = await getAlphaCorrelations(alphaId, session, cookie, db);
    const text = formatCorrelationResult(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

const listAlphasTool: AnyAgentTool = {
  name: "listAlphas",
  label: "Alpha列表",
  description:
    "获取当前用户在BRAIN平台的Alpha列表。支持按状态筛选和分页。" +
    "返回Alpha的ID、表达式、状态、Sharpe等关键指标，格式化为表格输出。",
  parameters: ListAlphasSchema,
  execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
    const status = rawParams.status as string | undefined;
    const limit = rawParams.limit as number | undefined;
    const offset = rawParams.offset as number | undefined;

    const { session, cookie } = await getAuthSession();
    const result = await listAlphas({ status, limit, offset }, session, cookie);
    const text = formatAlphaList(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

const getUserInfoTool: AnyAgentTool = {
  name: "getUserInfo",
  label: "获取用户信息",
  description:
    "获取当前登录用户的BRAIN平台信息，包括用户名、ID、邮箱等。" +
    "用于确认当前登录身份和账号状态。",
  parameters: GetUserInfoSchema,
  execute: async (_toolCallId: string, _rawParams: Record<string, unknown>) => {
    const { session, cookie } = await getAuthSession();
    const result = await getUserInfo(session, cookie);
    const text = formatUserInfo(result);
    return { content: [{ type: "text" as const, text }] };
  },
};

// ── Plugin Entry ──────────────────────────────────────────────

export default definePluginEntry({
  id: "wq-buddy",
  name: "WQBuddy",
  description:
    "WorldQuant BRAIN Alpha挖掘协作工具 - 字段勘探、表达式构建、回测分析、优化迭代和提交管理",
  register(api) {
    api.registerTool(alphaBatchSubmitTool as AnyAgentTool);
    api.registerTool(searchFieldsTool as AnyAgentTool);
    api.registerTool(analyzeFieldTool as AnyAgentTool);
    api.registerTool(alphaStatsTool as AnyAgentTool);
    api.registerTool(updateSubmitStatusTool as AnyAgentTool);
    api.registerTool(updateCorrelationTool as AnyAgentTool);
    api.registerTool(checkSubmissionTool as AnyAgentTool);
    api.registerTool(submitAlphaTool as AnyAgentTool);
    api.registerTool(getAlphaCorrelationsTool as AnyAgentTool);
    api.registerTool(listAlphasTool as AnyAgentTool);
    api.registerTool(getUserInfoTool as AnyAgentTool);
  },
});
