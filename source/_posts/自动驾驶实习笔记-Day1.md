---
title: 自动驾驶实习笔记-Day1-2
date: 2026-07-14
tags: [自动驾驶, 实习, Linux, 部署]
categories: [南通智行未来实习, 实习笔记]
description: 易成自动驾驶现场部署实习前两天的收获总结
---

## Day 1：环境搭建与硬件认知

### 工作流程

- 上午：阅读部署文档 + 安装软件环境
- 下午：实车操作，熟悉硬件架构

### 装了的软件

| 软件 | 用途 |
|------|------|
| RSView | 激光雷达点云可视化 |
| MobaXterm | SSH 终端 + 文件传输 |
| Wireshark | 网络抓包（标定用） |
| AutoDriver | 实时监控各模块运行状态 |
| 规划工具 | 读取规划配置 |
| BY_Connect | 配置北云 IMU |
| dtucfg2 | 配置驿唐 DTU |

### 车载硬件拓扑

```
RTK 基站 → 4G → DTU(黑) → 串口 → IMU(白) → 网线 → 交换机 → EC-GC270 域控
激光雷达 ×4 ──────────────网线───────────→ 交换机
笔记本 ──────────────────网线───────────→ 交换机
```

| 硬件 | IP | 作用 |
|------|-----|------|
| EC-GC270 A 核 (RK3588) | 192.168.86.11 | 感知、规划、控制 |
| EC-GC270 B 核 (Journey 2) | 192.168.86.12 | 定位、融合 |
| 激光雷达 ×4 | .5 / .6 / .7 / .8 | 360° 环境感知 |
| 北云 IMU | .72 | 惯性导航 + 姿态测量 |
| 驿唐 DTU | 无 IP（串口通信） | 4G 收 RTK 差分修正信号 |

### 关键理解

DTU 通过 4G 接收 RTK 基站的差分修正信号，通过串口喂给 IMU。IMU 融合 GPS + RTK + 惯性数据，把定位精度从**米级提升到厘米级**。

### 部署四步走

1. **配雷达 IP**：浏览器直连雷达改 IP（一次性）
2. **标定录包**：Wireshark 抓包，静态 5 秒 + 动态 30 米
3. **配 IMU + DTU**：by_connect 配天线位置，驿唐上位机配 RTK 参数
4. **录地图 + 部署**：driverlessDFX 录轨迹 → MobaXterm 上传程序

---

## Day 2：深入理解系统架构

### 两个车辆系统

| | 洗地车（实操） | L4 自动驾驶车 |
|------|------|------|
| 目标设备 | 192.168.86.100 | A 核 .11 / B 核 .12 |
| 用户 | neardi | root |
| 进程管理 | systemd（can.service / sweeper.service） | pkill + nohup |
| 对应脚本 | sweeper.sh | deploy.sh |

### 七款软件的全景图

```
配硬件（一次性）                日常使用
┌──────────────────┐       ┌──────────────────┐
│ BY_Connect       │       │ AutoDriver       │
│   配 IMU 参数     │       │   实时仪表盘      │
│ dtucfg2.exe      │       │ RSView           │
│   配 DTU RTK     │       │   看点云画面      │
│ 浏览器            │       │ 规划工具          │
│   配雷达 IP       │       │   读规划配置      │
└──────────────────┘       │ MobaXterm        │
                           │   终端 + 传文件   │
                           └──────────────────┘
```

### 软件依赖关系

| 设备 | IP | 用哪个软件操作 |
|------|-----|------|
| A 核 | .11 | MobaXterm、AutoDriver、deploy.sh |
| B 核 | .12 | MobaXterm、AutoDriver、deploy.sh |
| 规划模块 | .15 | 规划工具、MobaXterm |
| 激光雷达 ×4 | .5/.6/.7/.8 | RSView、浏览器 |
| IMU | .72 | BY_Connect |
| DTU | 无 IP | dtucfg2.exe（串口） |

### 自动化部署脚本工作原理

```
插网线 → Git Bash 运行 ./sweeper.sh deploy start.sh
     ↓
脚本自动：ssh 连车 → scp 上传 → chmod 赋权 → systemctl restart → 验证
     ↓
终端输出 ✅ 成功 或 ❌ 失败
```

脚本帮你省掉的是**手动 ssh + 输密码 + 多次敲命令**的机械劳动，底层执行的还是带教给你的那些原始命令。

### Linux 进阶命令

- `grep -C N "关键词"` — 查找并显示前后 N 行上下文
- `grep -E "A|B"` — 正则匹配多个关键词
- `awk '{print $N}'` — 提取第 N 列
- `sed 's/旧/新/g'` — 文本替换
- `管道组合` — `grep ERROR \~\/log | awk '{print $1,$2}'`
- `journalctl -u 服务名 -n 50 --no-pager` — 查服务日志

---

## Day 1 踩的坑

| 问题 | 解决 |
|------|------|
| RSView zip 解压失败（compression method 95） | 用 `bsdtar -xf` 替代 unzip |
| MobaXterm Session 连不上 | 没连车时必然超时，Session 先存好 |
| AutoDriver 全报 error | 没连车没数据，插网线即好 |
| Git Bash 路径写 `E:` 不生效 | 用 `/e/文件夹名` |

## 岗位认知

本质是**自动驾驶现场测试 + 运维**：
- 日常：看状态、查日志、重启模块
- 偶尔：换程序、改配置、换地图
- 很少：配雷达、做标定、录新地图

> 核心竞争力：实车部署经验 + Linux 运维 + 自动驾驶整车系统理解 → 简历含金量远超普通 Java 开发实习。实习经历是加分项，Java 后端才是饭碗，主赛道不能偏。
