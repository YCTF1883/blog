---
title: Amadeus Phase 3 — TTS 语音合成搭建（子进程架构 + WebSocket 实时语音）
date: 2026-07-17
tags: [Amadeus, TTS, Qwen-TTS, WebSocket, FastAPI, Vue3, Christina-TTS, 牧濑红莉栖]
categories: [Amadeus项目企划书]
description: 为 Amadeus 接入红莉栖的日语语音，踩坑记录：子进程架构设计、Windows 管道编码问题、中日翻译层、WebSocket 音频传输。
---

## 项目背景

Phase 3 的目标是让 Amadeus **开口说话**——用牧濑红莉栖自己的声音回复你，就像动漫里那样。

| 需求 | 方案 |
|---|---|
| 语音合成 | Christina-TTS (Qwen-TTS 格式, 日语红莉栖声音) |
| 运行环境 | conda `sovits` 环境 (Python 3.10 + CUDA torch 2.7.1) |
| 主程序环境 | Python 3.13 (CPU torch) |
| 通信方式 | 子进程 stdin/stdout JSON 通信 |
| 前端 | Vue 3 + WebSocket 接收 WAV 音频播放 |

---

## 一、架构设计：为什么用子进程？

Python 3.13 装不上 CUDA 版 PyTorch，而 TTS 模型需要 GPU 推理。有两个选择：

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 整个项目降级到 3.10 | 单环境简单 | LangGraph 新版可能不支持 3.10，治标不治本 |
| B. 子进程隔离 | 各用各的，互不干扰 | 进程间通信需要额外处理 |

**选了 B**——业界标准做法，主程序用新版 Python，GPU 密集型任务在子进程跑。

```
┌──────────────────────────────┐
│  main.py (Python 3.13)       │
│  FastAPI + LangGraph Agent   │
│                              │
│  synthesize(text)            │
│    │                         │
│    ▼                         │
│  _tts_worker.py (Python 3.10)│
│  Christina-TTS 模型常驻内存    │
│  通过 stdin/stdout 通信       │
└──────────────────────────────┘
```

---

## 二、TTS 引擎核心代码

### 2.1 Worker 子进程 (`_tts_worker.py`)

模型只加载一次，后续通过 stdin 接收 JSON 任务：

```python
"""TTS 常驻工作进程 —— 模型只加载一次，通过 stdin/stdout 接收任务"""
import sys, os, json
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

print("LOADING", flush=True)
model = Qwen3TTSModel.from_pretrained(
    "D:/ai-tools/Christina-TTS",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)
print("READY", flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line: continue
    if line == "EXIT": break

    try:
        task = json.loads(line)
        text = task["text"]
        output_path = task["output"]
        instruct = task.get("instruct", "")

        kwargs = {}
        if instruct:
            kwargs["instruct"] = instruct

        wavs, sr = model.generate_custom_voice(
            text=text,
            speaker="christina-jp",
            language="Japanese",
            **kwargs,
        )
        sf.write(output_path, wavs[0], sr)
        print("OK", flush=True)
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
```

**关键点**：`flush=True` 必须加，否则子进程 stdout 缓冲，父进程永远读不到。

### 2.2 封装层 (`tts.py`)

```python
"""TTS 引擎 —— 常驻进程调用 sovits 环境生成红莉栖语音"""
import subprocess, tempfile, os, json

SOVITS_PYTHON = "D:/conda_envs/sovits/python.exe"
WORKER_SCRIPT = os.path.join(os.path.dirname(__file__), "_tts_worker.py")

_worker = None

def _read_until(stream, marker: str):
    """一直读 stdout 直到某行包含 marker，跳过中间所有行"""
    while True:
        line = stream.stdout.readline()
        if not line:
            raise RuntimeError(f"TTS worker 进程意外退出（等待 {marker} 时管道关闭）")
        if marker in line:
            return

def _get_worker():
    """启动或返回 TTS 常驻进程"""
    global _worker
    if _worker is None or _worker.poll() is not None:
        _worker = subprocess.Popen(
            [SOVITS_PYTHON, WORKER_SCRIPT],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,  # 关键：不要 PIPE，否则 flash-attn 警告填满管道
            text=True,
        )
        _read_until(_worker, "LOADING")
        _read_until(_worker, "READY")
    return _worker

async def synthesize(text: str, instruct: str = "") -> bytes:
    """将日语文本合成红莉栖语音，返回 WAV 音频字节"""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out_path = f.name

    try:
        worker = _get_worker()

        # 关键：ensure_ascii=True 避免 Windows 管道日文乱码
        task = json.dumps(
            {"text": text, "output": out_path, "instruct": instruct},
            ensure_ascii=True,
        )
        worker.stdin.write(task + "\n")
        worker.stdin.flush()

        # 跳过 Qwen-TTS 的警告行，读到 OK 或 ERROR
        while True:
            line = worker.stdout.readline()
            if not line:
                raise RuntimeError("TTS worker 进程意外退出")
            if "OK" in line:
                break
            if "ERROR" in line:
                raise RuntimeError(f"TTS 失败: {line.strip()}")

        with open(out_path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)
```

---

## 三、WebSocket 语音通道

整个流程：

```
前端点 🔊 → WebSocket 发中文文本
  → DeepSeek 中→日翻译 (~1s)
  → TTS 合成日语语音 (~3s)
  → WebSocket 回传 WAV 二进制
  → 前端 <audio> 播放
```

```python
# main.py

@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            text = await websocket.receive_text()
            if not text.strip():
                continue

            # 中→日翻译（用 DeepSeek 快速翻译）
            ja_text = await _to_japanese(text)

            # TTS 合成
            audio_bytes = await synthesize(ja_text, instruct="少しゆっくり話してください")
            await websocket.send_bytes(audio_bytes)

    except WebSocketDisconnect:
        print("🔊 语音 WebSocket 已断开")
```

### 翻译 Prompt 设计

```python
async def _to_japanese(text: str) -> str:
    client = AsyncOpenAI(api_key=config.DEEPSEEK_API_KEY, base_url=config.DEEPSEEK_BASE_URL)
    resp = await client.chat.completions.create(
        model=config.DEEPSEEK_MODEL,
        messages=[{
            "role": "system",
            "content": (
                "你是一个日文翻译助手。把用户输入的中文翻译成日文，"
                "保持牧濑红莉栖（Makise Kurisu）的语气：自信、略带傲娇、偶尔用科学术语。"
                "只输出日文译文，不要加任何解释或前缀。"
            ),
        }, {"role": "user", "content": text}],
        temperature=0.3,
        max_tokens=512,
    )
    return resp.choices[0].message.content.strip()
```

---

## 四、前端语音按钮

### WebSocket 客户端 (`useVoice.js`)

```js
import { ref } from 'vue'

export function useVoice() {
  const isSpeaking = ref(false)
  let ws = null

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return ws
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/ws/voice`)
    return ws
  }

  async function speak(text) {
    if (!text.trim() || isSpeaking.value) return
    isSpeaking.value = true
    const socket = connect()
    if (socket.readyState !== WebSocket.OPEN) {
      await new Promise(resolve => { socket.onopen = resolve })
    }

    socket.onmessage = async (event) => {
      const blob = new Blob([event.data], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); isSpeaking.value = false }
      await audio.play()
    }

    socket.send(text)
  }

  return { isSpeaking, speak }
}
```

### App.vue 中每条回复末尾加 🔊 按钮

```html
<button
  v-if="msg.role === 'assistant' && msg.content && !isLoading"
  class="btn-speak"
  :disabled="isSpeaking"
  @click="speak(msg.content)"
>🔊</button>
```

---

## 五、预加载优化

TTS 模型首次加载需要 ~30 秒。在 FastAPI 启动时后台预加载：

```python
@app.on_event("startup")
async def startup():
    # ... Agent 初始化 ...

    # 后台预加载 TTS 模型
    import threading
    from backend.app.speech.tts import _get_worker

    def preload_tts():
        print("⏳ 预加载 TTS 模型...")
        _get_worker()
        print("✅ TTS 模型已就绪")

    thread = threading.Thread(target=preload_tts, daemon=True)
    thread.start()
```

这样第一次点 🔊 直接 4-5 秒出语音，不用等 30 秒。

---

## 六、完整踩坑记录

| # | 问题 | 原因 | 解决方案 |
|---|---|---|---|
| 1 | 子进程 stdout 读到空行，不是 "LOADING" | Qwen-TTS 启动时往 stdout 喷 flash-attn 警告 | `_read_until()` 循环跳过所有非目标行 |
| 2 | `stderr=subprocess.PIPE` 导致死锁 | flash-attn 警告填满 stderr 管道缓冲区 | 改为 `stderr=subprocess.DEVNULL` |
| 3 | Worker 收到中文文本后直接崩溃 | Christina-TTS 是日语模型，不接受中文输入 | 加中→日翻译层 (DeepSeek API) |
| 4 | `ensure_ascii=False` 传日文到子进程变成乱码 | Windows 子进程管道对非 ASCII 字符编码有问题 | 改为 `ensure_ascii=True`，用 `\uXXXX` 转义 |
| 5 | 主程序 `ModuleNotFoundError: No module named 'torch'` | 之前删 torch 残留包时把 `sentence_transformers` 依赖的 torch 也搞没了 | `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| 6 | `ModuleNotFoundError: No module named 'websockets.asyncio'` | `langgraph_sdk` 需要 websockets >= 13.0 | `pip install websockets --upgrade` |
| 7 | `AttributeError: module 'torch' has no attribute 'Tensor'` | 残留 torch 子包（functorch/torchgen/torchaudio）让 scipy 误判有 torch | 手动删除残留目录后重装 CPU torch |
| 8 | numpy 版本冲突 `numba needs NumPy <=2.4, got 2.5` | sovits 环境的依赖冲突 | `pip install numpy==2.1.3` |
| 9 | Christina-TTS 下载失败 | hf-mirror 浏览器下载时文件重名（`config (1).json`） | 手动下载 + `ren` 修复文件名 |
| 10 | Node 版本太旧 Vite 8 失败 | Vite 8 需要 Node >= 20.19.0，本机是 20.18.1 | 升级到 Node 22.23.1 LTS |

---

## 七、延迟分析

| 环节 | 耗时 | 可优化？ |
|---|---|---|
| 中→日翻译 (DeepSeek API) | ~1s | 后续让 Agent 直接输出日文可省 |
| TTS 模型推理 (RTX 4060) | ~3s | 模型已是最优，硬件限制 |
| **合计** | **~4-5s** | |

与动漫里秒回的红莉栖差距不小，但实时对话可以接受。后续如果换流式 TTS（GPT-SoVITS+VITS），延迟体感会更好。

---

## 八、已知局限

1. **语速固定、无情绪控制** — Christina-TTS 是单说话人模型，不支持情感参数
2. **无流式输出** — 需要等全句生成完才能播放
3. **翻译增加延迟** — Agent 中文输出 → 翻译日文 → TTS，多一步 API 调用

**后续方向**：用 GPT-SoVITS 自训练带情感标签的红莉栖语音模型，替换 `_tts_worker.py` 的模型加载和生成逻辑，保持子进程架构不变。

---

## 九、架构启示

这次 TTS 集成验证了一个重要设计原则：**环境隔离比环境统一更重要**。

```
Python 3.13（主程序）         Python 3.10 + CUDA（TTS）
  FastAPI ──subprocess──→      Qwen-TTS 模型
  LangGraph                    GPU 推理
  ChromaDB
```

不用为了兼容一个依赖而拖累整个项目。通过子进程 stdin/stdout 协议通信，两端可以自由选最优的 Python 版本和依赖集。这个模式后续做 STT（语音识别）和自训练模型时同样适用。
