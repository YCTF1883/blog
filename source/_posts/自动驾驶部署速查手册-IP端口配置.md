---
title: 自动驾驶部署速查手册 — IP地址、端口、配置参数
date: 2026-07-15
tags: [自动驾驶, 部署, 速查手册, IP配置, 实习]
categories: [南通智行未来实习, 技术笔记]
description: 基于实习部署指导文档整理，涵盖激光雷达、IMU、域控制器、DTU等所有关键IP地址、端口号、配置步骤，方便现场快速查阅。
---

## 一、总览：系统拓扑

```
RTK基站 → 4G → DTU(MD-649) → 串口 → IMU(BY_Connect)
                                        ↓
                              交换机(车载) ← 激光雷达×4
                              ↙        ↘
                    A核(.11)              B核(.12)
                控制/感知/规划            定位/融合
```

## 二、所有 IP 地址速查

### 2.1 车载设备 IP

| 设备 | IP 地址 | 端口/说明 |
|------|---------|-----------|
| **A核（控制/感知/规划）** | `192.168.86.11` | root / launch |
| **B核（定位/融合）** | `192.168.86.12` | root / launch |
| **EC-GC270 维护口** | `192.168.86.2` | echiev / launch |
| **IMU（北云）** | `192.168.86.72` | TCP 端口 `2222` |
| **顶上中间激光雷达** | `192.168.86.5` | MSOP:`2410` DIFOP:`2411` |
| **左前激光雷达** | `192.168.86.6` | MSOP:`2412` DIFOP:`2413` |
| **右前激光雷达** | `192.168.86.7` | MSOP:`2414` DIFOP:`2415`（道尔智控，目前无此雷达） |
| **后激光雷达** | `192.168.86.8` | MSOP:`2416` DIFOP:`2417` |

> ⚠️ **避让清单**：笔记本配 IP 时不要占用 `5, 6, 7, 8, 11, 12, 22, 23, 72`，建议用 `192.168.86.88`

### 2.2 笔记本端配置

| 项目 | 值 |
|------|-----|
| 本机 IP | `192.168.86.88`（或其他未被占用的） |
| 子网掩码 | `255.255.255.0` |
| 雷达配置临时 IP | `192.168.1.102`（直连雷达用） |

## 三、激光雷达配置

### 3.1 Web 页面配置（初次配置）

1. 笔记本设 IP 为 `192.168.1.102`，网线直连雷达
2. 浏览器访问 `192.168.1.200`
3. 在 Web 页面的 Setting 中修改：

| 参数 | 顶上中间雷达 | 左前雷达 | 右前雷达 | 后雷达 |
|------|--------------|----------|----------|--------|
| Device IP | `192.168.86.5` | `192.168.86.6` | `192.168.86.7` | `192.168.86.8` |
| IP Mask | `255.255.255.0` | `255.255.255.0` | `255.255.255.0` | `255.255.255.0` |
| Gateway | `192.168.86.1` | `192.168.86.1` | `192.168.86.1` | `192.168.86.1` |
| Dest IP | `192.168.86.255` | `192.168.86.255` | `192.168.86.255` | `192.168.86.255` |
| MSOP Port | `2410` | `2412` | `2414` | `2416` |
| DIFOP Port | `2411` | `2413` | `2415` | `2417` |

4. 点击 **Save**，重启雷达

### 3.2 RSView 验证

- 打开 RSView，填入对应雷达的 MSOP 端口号
- 点云正常显示 = 配置成功
- 雷达频率确认设为 **10Hz**

## 四、IMU（北云）配置

### 4.1 硬件连接

- USB 转 RS232 串口线连接电脑和 IMU
- 设备管理器查看 COM 口号 → 用 **BY_Connect** 软件连接

### 4.2 串口参数

| 参数 | 值 |
|------|-----|
| 波特率 | `115200` |
| COM 口 | 在设备管理器确认 |

### 4.3 关键 AT 指令序列

按顺序逐条发送（每条都要有回复）：

```
LOG COM1 GPGGA ONTIME 1

SETINSTRANSLATION ANT1 0.30 -0.80 0.36 0.05 0.05 0.05 IMUBODY
# 主天线位置（相对IMU，单位m）

SETINSTRANSLATION ANT2 0.30 0.05 0.36 0.05 0.05 0.05 IMUBODY
# 从天线位置

IPCONFIG ETHA STATIC 192.168.86.72 255.255.255.0 192.168.86.2
# 设置IMU静态IP

ICOMCONFIG ICOM1 UDP 192.168.86.255:1111
# 配置数据输出方式

LOG ICOM1 RAWIMUSA ONTIME 0.01
LOG ICOM1 INSPVAA ONTIME 0.01
LOG ICOM1 BESTGNSSPOSA ONTIME 1
LOG ICOM1 GPZDA ONTIME 1
RAWIMUOUT ON
LOG NTRIPCONFIG ONCE
# 查询 NTRIP 配置是否正确

SAVECONFIG
REBOOT
```

### 4.4 验证

- BY_Connect 通过 TCP/IP 连接 `192.168.86.72:2222`
- AutoDriver 中观察 **4-4 定位标志**（表示高精度定位已就绪）

## 五、A核 / B核 关键路径

### 5.1 程序部署路径

| 模块 | 路径 | 所在核心 |
|------|------|----------|
| 控制 control | `/etc/echiev/bin/control` | A核 (.11) |
| 感知 lidar | `/etc/echiev/bin/lidar` | A核 (.11) |
| 规划 planning | `/etc/echiev/bin/plinening` | A核 (.11) |
| 定位 localization | `/etc/echiev/bin/localization` | B核 (.12) |
| 融合 fusion | `/etc/echiev/bin/fusion` | B核 (.12) |

### 5.2 配置文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 启动脚本 | `/etc/echiev/autostart/S99_lidar.sh` | CAN 通信参数 + 启动程序列表 |
| 控制配置 | `/etc/echiev/control_new/control_conf.cfg` | A核 (.11) |
| 规划配置 | `/etc/echiev/planning/` | A核 (.11) |
| 定位配置 | `/etc/echiev/localization.cfg` | B核 (.12) |
| 高精地图 | `/etc/echiev/hdmap/hdmap.bin` | **A核+B核**都要更新 |
| 规划参数 | `/etc/echiev/plinening/pline.cfg` | 速度/停站时间 |

### 5.3 日志路径

| 日志 | 路径 |
|------|------|
| 规划日志 | `/etc/ulog/plan/` |
| 控制日志 | `/etc/ulog/control/` |

## 六、DTU（4G 数传模块）配置

| 项目 | 参数 |
|------|------|
| 设备 | 驿唐 MD-649 |
| 配置工具 | `dtucfg2.exe`（串口配置） |
| 波特率 | `115200` |
| 第2路串口 | `8002` |

> DTU 接收 RTK 基站 4G 信号，通过串口转发给 IMU。

## 七、常用软件清单

| 软件 | 用途 | 路径/说明 |
|------|------|-----------|
| **MobaXterm / Xshell** | SSH 终端 | 连接 A核 (.11)、B核 (.12) |
| **WinSCP** | 文件传输 | 拖拽上传程序/配置 |
| **AutoDriver** | 实时监控 | 查看自动驾驶状态、地图 |
| **net8.0-windows** | 规划工具 | AutoDriver 辅助，读取规划配置 |
| **RSView** | 激光雷达点云 | 配置 MSOP/DIFOP 端口查看 |
| **BY_Connect** | IMU 配置 | 串口 + TCP `192.168.86.72:2222` |
| **dtucfg2.exe** | DTU 配置 | 串口连接配置 |
| **driverlessDFX2.0** | 地图录制 | 录制高精地图数据 |
| **Wireshark** | 抓包分析 | 雷达标定抓 pcap |

## 八、部署标准流程

### 8.1 传程序

```bash
# 以 control 为例
# 1. 备份旧文件
ssh root@192.168.86.11 "cp /etc/echiev/bin/control /etc/echiev/bin/control.bak.$(date +%Y%m%d_%H%M%S)"

# 2. 上传新程序（本机执行）
scp control root@192.168.86.11:/etc/echiev/bin/

# 3. 赋权
ssh root@192.168.86.11 "chmod 777 /etc/echiev/bin/control"

# 4. 杀进程重启
ssh root@192.168.86.11 "pkill -9 control; cd /etc/echiev/bin && nohup ./control > /dev/null 2>&1 &"

# 5. 确认进程
ssh root@192.168.86.11 "pgrep control && echo '✅ 运行中' || echo '❌ 未运行'"
```

### 8.2 传配置

```bash
# pline.cfg 只需替换，然后重启对应模块
scp pline.cfg root@192.168.86.11:/etc/echiev/plinening/
ssh root@192.168.86.11 "pkill -9 plinening; cd /etc/echiev/bin && nohup ./plinening > /dev/null 2>&1 &"
```

### 8.3 更新高精地图

```bash
# 两个核心都要更新
scp hdmap.bin root@192.168.86.11:/etc/echiev/hdmap/
scp hdmap.bin root@192.168.86.12:/etc/echiev/hdmap/
```

## 九、规划参数修改（pline.cfg）

在 `192.168.86.2` 的 `/etc/echiev/plinening/pline.cfg`：

| 参数 | 含义 | 单位 |
|------|------|------|
| `fparkTime` | 停站时间 | 秒(s) |
| `fspeedLimit` | 最高速度 | 米/秒(m/s) |
| `iobjectExist=0` | 忽略障碍物 | — |
| `iobjectExist=1` | 遇障停车 | — |
| `icuriseModel=0` | 条件允许下绕障 | — |
| `icuriseModel=1` | 不绕障 | — |
| `isituationModel=0` | 循迹模式 | — |
| `isituationModel=1` | 叫车模式 | — |

> 修改后重启 planning 模块生效。

## 十、状态检查速查

```bash
# A核
ssh root@192.168.86.11
pgrep control && echo "✅ control" || echo "❌ control"
pgrep lidar && echo "✅ lidar" || echo "❌ lidar"
pgrep plinening && echo "✅ planning" || echo "❌ planning"

# B核
ssh root@192.168.86.12
pgrep localization && echo "✅ localization" || echo "❌ localization"
pgrep fusion && echo "✅ fusion" || echo "❌ fusion"

# 看日志
journalctl -u sweeper.service -n 50 --no-pager   # 洗地车
tail -n 30 /etc/ulog/system.log | grep -E "ERROR|WARN"  # 通用
```

---

> 📝 整理自《智行未来部署.pdf》(2026-05-28)、《EC-GC270 使用说明》、驿唐《MD-649 用户使用手册》。
> 仅供现场部署参考，以最新版本文档为准。
