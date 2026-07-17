---
title: Amadeus Phase 1 — 项目骨架与 Agent 核心搭建
date: 2026-07-15
tags: [Amadeus, AI Agent, LangGraph, DeepSeek, FastAPI, Python, 命运石之门]
categories: [Amadeus项目企划书]
description: 从零搭建 Amadeus 智能助手 Phase 1，深入理解 Agent 架构、ReAct 循环、工具调用机制、以及与 Java 生态的对比思考。
---

## 项目背景

**Amadeus** 是命运石之门中牧濑红莉栖记忆的数字化 AI 系统。本项目目标是从零构建一个真实的"Amadeus"——一个能对话、能做事、有角色性格的智能 Agent 助手。

| 属性 | 值 |
|---|---|
| 代号 | Amadeus |
| 角色 | 牧濑红莉栖（Makise Kurisu）|
| LLM | DeepSeek V3 |
| 语言 | Python 3.13 |
| 框架 | FastAPI + LangChain + LangGraph |

---

## 一、Python vs Java：包管理的思维差异

作为一个从 Java 转过来的新手，最先打破认知的是：**Python 没有 Spring Initializr**。

| | Java（Maven/Gradle） | Python（pip） |
|---|---|---|
| 依赖清单 | `pom.xml` / `build.gradle` | `requirements.txt` |
| 安装命令 | `mvn install` | `pip install -r requirements.txt` |
| 包物理位置 | `~/.m2/repository/` | `site-packages/` |
| 项目骨架 | Spring Initializr 自动生成 | **手动创建** |
| 包名规则 | groupId 分隔 | 装时 `langchain-core`，导入时 `langchain_core` |

`requirements.txt` 只是一个购物清单——真正安装需要执行 `pip install -r requirements.txt`。

```bash
# requirements.txt 里的东西
fastapi>=0.110.0          # Web 框架 → 等于 Spring Boot
uvicorn[standard]>=0.29.0  # 服务器   → 等于 Tomcat
langchain>=0.3.0           # LLM 操作库
langchain-openai>=0.2.0    # DeepSeek 兼容 OpenAI 接口的驱动
langgraph>=0.2.0           # Agent 编排框架（ReAct 循环）
python-dotenv>=1.0.0       # 读取 .env 配置
pydantic>=2.0.0            # 数据校验 → 等于 Java Bean Validation
```

---

## 二、项目架构：三层拆分

```
┌─────────────────────────────────────────┐
│  API 层 (main.py)                       │  ← HTTP ↔ 字符串
│  FastAPI 接收请求，调用 Agent，返回 JSON  │
├─────────────────────────────────────────┤
│  Agent 核心层 (graph.py)                 │  ← 把字符串交给"已带 tools 的图"
│  LangGraph 管理 ReAct 循环、工具调用、记忆 │
├─────────────────────────────────────────┤
│  零件层                                  │
│  config.py / prompts.py / tools.py      │
└─────────────────────────────────────────┘
```

核心概念：**main.py 只做 HTTP 和字符串的互转，真正的大脑在 graph.py**。

---

## 三、Phase 1 项目文件清单

```
amadeus/
├── .env                          ← API Key，不提交 Git
├── .env.example                  ← 模板文件，告诉别人要填什么
├── .gitignore                    ← 排除 .env、.idea、node_modules
├── requirements.txt              ← 依赖清单
│
├── backend/
│   └── app/
│       ├── main.py               ← FastAPI 入口 / API 路由
│       ├── config.py             ← 从 .env 读配置
│       ├── agent/
│       │   ├── graph.py          ← 🧠 Agent 大脑 (LangGraph ReAct)
│       │   ├── prompts.py        ← 🎭 牧濑红莉栖 System Prompt
│       │   └── tools.py          ← 🔧 工具集 (时间/计算/提醒)
│       ├── models/
│       │   └── schemas.py        ← 📋 Pydantic 数据模型
│       ├── memory/               ← (Phase 2 长期记忆)
│       ├── rag/                  ← (Phase 2 知识库)
│       ├── speech/               ← (Phase 3 语音)
│       └── mocap/                ← (Phase 5 动捕)
│
├── frontend/                     ← (Phase 3 前端界面)
└── live2d/kurisu/                ← (Phase 4 牧濑红莉栖 Live2D 模型)
```

> 注意：`memory/`、`rag/`、`speech/` 等目录目前只是空的占位符，和 Java Spring Initializr 不同，Python 项目没有脚手架自动生成——所有文件都是手写的。

---

## 四、核心概念深度解析

### 4.1 System Prompt：角色的"灵魂"

LLM 收到的不是"一句话"，而是一个**消息列表**：

```
┌──────────────────────────────────────┐
│ SystemMessage                       │  ← AMADEUS_SYSTEM_PROMPT
│ "你是 Amadeus，牧濑红莉栖的AI分身…"   │     定义角色、性格、行为边界
├──────────────────────────────────────┤
│ HumanMessage (历史)                  │  ← 之前的对话（如果有）
│ HumanMessage (历史)                  │
├──────────────────────────────────────┤
│ HumanMessage (当前)                  │  ← 用户刚发的消息
│ "现在几点？"                         │
└──────────────────────────────────────┘
```

System Prompt 不参与对话轮次，但影响 LLM 的**每一个 token 输出**。关键设计点：

- **`# 身份`**：给 LLM 一个"锚点"
- **`# 性格`**：具体行为描述，比说"你要傲娇"有效得多
- **`# 说话风格`**：给出参考台词，LLM 会模仿语气
- **`# 知识领域`**：限定 LLM 的"舒适区"，减少胡编
- **`# 重要规则`**：硬约束——**永远不说自己是 ChatGPT**

### 4.2 Function Call：Agent 怎么"做事"

**普通 API 调用 vs Agent**：

```
普通: 用户问 → LLM 答    （LLM 只能靠训练数据，不知道实时时间）

Agent: 用户问 → LLM 决定调哪个工具 → 执行工具 → 结果返回 LLM → LLM 答
```

`@tool` 装饰器的魔法：

```python
@tool
def get_current_time() -> str:
    """获取当前日期和时间。当用户问"现在几点"、"今天几号"时调用。"""
    now = datetime.datetime.now()
    ...
```

`@tool` 自动把函数的 name 和 docstring 转成 LLM 能理解的 JSON：

```json
{
  "name": "get_current_time",
  "description": "获取当前日期和时间。当用户问"现在几点"、"今天几号"时调用。"
}
```

**关键认知**：LLM 不是直接看到 Python 代码——它看到的是这个 JSON 描述。所以 **docstring 写得好不好，决定 LLM 会不会正确调用这个工具**。

### 4.3 ReAct 循环：Agent 的"思考链"

```
ReAct = Reasoning（推理）+ Acting（行动）

用户: "现在几点？"
  ↓
第1轮思考: LLM 带着 SystemPrompt 分析 → "用户要时间，我需要调工具"
  ↓
第1轮行动: LangGraph 拦截 → 执行 get_current_time() → "2026年7月15日 17:30"
  ↓
第2轮思考: LLM 收到工具结果 → "我现在可以组织回答了"
  ↓
第2轮行动: 输出 "哼，17:30了。你连时间都不看？"
```

**关键认知**：性格不是在最后"加上去"的，而是从第一轮 SystemPrompt 就放在消息最前面——**每一步思考都带着角色性格**。

LLM 必须在"知道时间"之后才能生成带具体数字的回复。第一次思考时它还不知道时间，所以只能输出一个"去查时间"的指令。这就像你让别人帮你查东西——不查就不可能说出具体数字。

**LangGraph 做的事**：`ainvoke()` 内部自动循环"思考→行动→思考→行动"，直到 LLM 认为不需要再调工具、直接输出文本。一次 `ainvoke` 背后可能调了 DeepSeek 好几次，每次都要消耗 token——这就是为什么 Agent 比普通聊天贵。

---

## 五、完整数据流

```
浏览器 (http://localhost:8000/docs)
  │  POST /api/chat
  │  Body: {"message": "现在几点？"}
  ▼
main.py           ← HTTP ↔ 字符串
  │  ChatRequest 自动校验，调用 get_agent()
  ▼
graph.py          ← 把字符串交给"已带 tools 的图"
  │  拼装消息: [SystemMessage(角色), HumanMessage("现在几点？")]
  ▼
LangGraph ReAct   ← 在一次 ainvoke 内自动完成「想 → 调工具 → 再想」
  │  带着可用工具列表发给 DeepSeek
  ▼
DeepSeek API      ← 第1次 HTTP：分析 → 返回 tool_call
  │  
  ▼
本地执行工具       ← LangGraph 拦截 tool_call，执行 Python 函数
  │  返回: "现在是 2026年7月15日 17:30"
  ▼
DeepSeek API      ← 第2次 HTTP：工具结果 + 角色 → 生成最终回复
  │  返回: "哼，17:30了。连时间都不看？"
  ▼
main.py           ← ChatResponse → JSON
  ▼
浏览器             ← 显示回复
```

---

## 六、遇到的实际问题

### LangGraph API 参数变更

启动时报错：
```
create_react_agent() got unexpected keyword arguments: {'state_modifier': ...}
```

原因：LangGraph 1.x 把参数名从 `state_modifier` 改成了 `prompt`。

解决：只改一行——`state_modifier=SystemMessage(...)` → `prompt=SystemMessage(...)`。

**教训**：Python AI 生态中框架更新极快，API 说变就变。遇到 `got unexpected keyword arguments` 错误时，八成是参数名改了，用 `help(函数名)` 看最新的签名即可。

---

## 七、升级路径

项目架构决定了后续升级的改动范围：

| 升级什么 | 只改哪里 |
|---|---|
| 加工具（发邮件、查天气） | `tools.py` |
| 调角色性格 | `prompts.py` |
| 换底层 LLM | `config.py` |
| 改 Agent 思考方式 | `graph.py` |
| 加持久化记忆 | 新文件 + `graph.py` |
| 加语音/动捕/前端 | 各自目录 + `main.py` 加路由 |

**核心规律**：只加技能 → 只改 `tools.py`；改脑子 → 动 `graph.py`；加新领域 → 对应目录开新文件。

---

## 八、总结

Phase 1 完成了 Amadeus 的"大脑"搭建，核心收获：

1. **Python 项目没有脚手架**——每个文件都是手写的，但结构灵活
2. **System Prompt 是角色的锚点**——它在消息列表最前面，影响 LLM 的每一个 token
3. **Function Call 是 LLM 输出 JSON 指令**——不是魔法，是约定好的数据格式
4. **ReAct 循环 = 思考→行动→再思考**——由 LangGraph 自动管理，不用手写循环
5. **一次用户请求背后可能有多轮 LLM 调用**——这就是 Agent 比普通聊天消耗更多 token 的原因

下一阶段：给 Amadeus 加上发邮件、RAG 知识库等实际能力。
