---
title: Linux 常用命令速查手册（自动驾驶现场部署实战版）
date: 2026-07-14
tags: [Linux, systemctl, 命令速查, 部署]
categories: [南通智行未来实习, 技术笔记]
description: 从自动驾驶实习实战出发，系统性整理 Linux 常用命令，涵盖文件操作、权限管理、进程控制、systemd 服务、日志搜索、网络排查等场景。
---

## 一、目录与文件操作

### 基础操作

| 命令 | 作用 | 示例 |
|------|------|------|
| `pwd` | 查看当前目录路径 | `pwd` |
| `ls -l` | 列出文件详情（权限、大小、时间） | `ls -l /etc/echiev/` |
| `ls -lh` | 人类可读的文件大小（带K/M/G） | `ls -lh /etc/echiev/bin/` |
| `cd 目录` | 切换目录 | `cd /etc/echiev/` |
| `cd ..` | 返回上级目录 | `cd ..` |
| `mkdir 目录名` | 创建目录 | `mkdir backup_20260714` |
| `touch 文件名` | 创建空文件 | `touch log_20260714.md` |
| `cp 源 目标` | 复制文件 | `cp start.sh start.sh.bak` |
| `mv 源 目标` | 移动/重命名 | `mv /tmp/can.service /etc/systemd/system/` |
| `rm 文件名` | 删除文件 | `rm /tmp/old.tar.gz` |
| `rm -rf 目录` | 递归删除目录（危险！） | **慎用，不要用** |

### 查看文件

| 命令 | 作用 | 示例 |
|------|------|------|
| `cat 文件` | 查看全部内容 | `cat /etc/echiev/pline.cfg` |
| `head -n 20 文件` | 看前 20 行 | `head -n 20 /etc/ulog/system.log` |
| `tail -n 50 文件` | 看后 50 行 | `tail -n 50 /etc/ulog/system.log` |
| `tail -f 文件` | 实时跟踪日志 | `tail -f /etc/ulog/system.log` |
| `less 文件` | 分页浏览（可上下翻） | `less /etc/ulog/system.log` |
| `wc 文件` | 统计行数/单词数/字符数 | `wc /etc/ulog/system.log` |

---

## 二、文件权限（车上每次部署必做）

### 权限格式

```
-rwxr-xr-x  1 root root  123456 Jul 14 10:00 control
 └┬┘└─┬─┘└─┬─┘
  │   │    └── 其他用户权限（r-x = 可读+执行）
  │   └────── 同组用户权限（r-x）
  └────────── 文件类型+所有者权限（rwx = 读+写+执行）
```

| 数字 | 含义 |
|------|------|
| `7` | rwx（读+写+执行） |
| `6` | rw-（读+写） |
| `5` | r-x（读+执行） |
| `4` | r--（只读） |

| 命令 | 作用 | 示例 |
|------|------|------|
| `chmod 777 文件` | 所有人可读可写可执行（**车上标准操作**） | `chmod 777 control` |
| `chmod +x 文件` | 加可执行权限 | `chmod +x start.sh` |
| `chmod 644 文件` | 所有者读写，其他人只读 | `chmod 644 pline.cfg` |
| `ls -l 文件` | 查看权限 | `ls -l /etc/echiev/bin/control` |

---

## 三、进程管理（排查模块有没有跑）

| 命令 | 作用 | 示例 |
|------|------|------|
| `ps aux` | 查看所有进程 | `ps aux` |
| `ps aux \| grep 进程名` | 筛选特定进程 | `ps aux \| grep mc_node` |
| `pgrep 进程名` | 直接获取 PID | `pgrep control` |
| `kill PID` | 正常终止进程 | `kill 1234` |
| `kill -9 PID` | 强制杀死进程 | `kill -9 1234` |
| `pkill -9 进程名` | 按名称强制杀 | `pkill -9 control` |
| `nohup ./程序 &` | 后台启动程序（关了终端也不停） | `cd /etc/echiev/bin && nohup ./control > /dev/null 2>&1 &` |

---

## 四、systemd 服务管理（洗地车专用，最常用）

### 服务状态

| 命令 | 作用 |
|------|------|
| `systemctl status 服务名` | 查看服务状态（**最常用**） |
| `systemctl is-active 服务名` | 只看是否在运行 |
| `systemctl is-enabled 服务名` | 看是否开了开机自启 |
| `systemctl list-units --type=service` | 列出所有运行中的服务 |
| `systemctl list-units --type=service --all` | 列出所有服务（包括没运行的） |

### 启停控制

| 命令 | 作用 |
|------|------|
| `sudo systemctl start 服务名` | 启动服务 |
| `sudo systemctl stop 服务名` | 停止服务 |
| `sudo systemctl restart 服务名` | 重启服务（= stop + start） |
| `sudo systemctl reload 服务名` | 热重载配置（不中断服务） |

### 开机自启

| 命令 | 作用 |
|------|------|
| `sudo systemctl enable 服务名` | 开启开机自启 |
| `sudo systemctl disable 服务名` | 关闭开机自启 |
| `sudo systemctl daemon-reload` | 重新加载 systemd 配置（改了 .service 文件后必做） |

### 日志查看

| 命令 | 作用 |
|------|------|
| `journalctl -u 服务名 -n 50` | 最近 50 行日志 |
| `journalctl -u 服务名 -f` | 实时跟踪日志（Ctrl+C 退出） |
| `journalctl -u 服务名 --since "10:00"` | 只看今天 10 点之后的 |
| `journalctl -u 服务名 --no-pager` | 不分页，一次性全输出 |

### 车上实战

```bash
# 洗地车最常用的四条
sudo systemctl status can.service
sudo systemctl status sweeper.service
sudo systemctl restart sweeper.service
journalctl -u sweeper.service -n 50 --no-pager
```

---

## 五、日志搜索三剑客（grep / awk / sed）

### grep — 搜索过滤

| 命令 | 作用 |
|------|------|
| `grep "ERROR" 文件` | 搜索包含 ERROR 的行 |
| `grep -i "error" 文件` | 忽略大小写 |
| `grep -n "ERROR" 文件` | 带行号 |
| `grep -c "ERROR" 文件` | 统计出现次数 |
| `grep -C 3 "ERROR" 文件` | 显示匹配行的**前后各 3 行**（车上最实用） |
| `grep -E "ERROR\|WARN" 文件` | 同时匹配多个关键词 |
| `grep -v "INFO" 文件` | 排除含 INFO 的行（只看异常） |

### awk — 提取列

| 命令 | 作用 |
|------|------|
| `awk '{print $1}' 文件` | 提取第 1 列 |
| `awk '{print $1, $2}' 文件` | 提取第 1、2 列 |
| `awk '{print $NF}' 文件` | 提取最后一列 |
| `awk '{print $4}' 文件 \| sort \| uniq -c` | 统计第 4 列每项出现次数 |

### sed — 文本替换

| 命令 | 作用 |
|------|------|
| `sed 's/旧/新/g' 文件` | 替换文本（预览，不修改原文件） |
| `sed -i 's/旧/新/g' 文件` | 替换并保存到原文件 |
| `sed 's/WARN/WARNING/g' 文件` | 把 WARN 全部换成 WARNING |

---

## 六、管道与组合（核心思维）

### 管道符 `|`

```bash
# 前一个命令的输出 → 变成后一个命令的输入

# 案例1：只查看 ERROR 行的时间戳
grep "ERROR" /var/log/system.log | awk '{print $1, $2}'

# 案例2：统计各模块报错次数
grep "ERROR" /var/log/system.log | awk '{print $4}' | sort | uniq -c | sort -rn

# 案例3：查看服务日志中报错的前后文
journalctl -u sweeper.service --no-pager | grep -C 3 "ERROR"
```

---

## 七、网络与连通性排查

| 命令 | 作用 | 示例 |
|------|------|------|
| `ping -c 3 IP` | ping 3 次测连通 | `ping -c 3 192.168.86.100` |
| `ip addr` 或 `ifconfig` | 查看本机 IP | `ip addr` |
| `ip link show can0` | 查看 CAN 接口状态 | `ip link show can0` |
| `netstat -ano \| grep 端口` | 查看端口占用 | `netstat -ano \| grep 2222` |
| `ssh 用户名@IP` | 远程登录 | `ssh neardi@192.168.86.100` |
| `scp 文件 用户名@IP:远程路径` | 远程拷贝 | `scp start.sh neardi@192.168.86.100:/home/neardi/` |

---

## 八、磁盘与空间

| 命令 | 作用 | 示例 |
|------|------|------|
| `df -h` | 查看各磁盘剩余空间 | `df -h` |
| `du -sh 目录` | 查看目录总大小 | `du -sh /etc/echiev/` |
| `du -h --max-depth=1` | 查看一级子目录各占多少 | `du -h --max-depth=1 /var/log/` |

---

## 九、压缩与解压

| 命令 | 作用 |
|------|------|
| `tar -czf 压缩包名.tar.gz 源目录` | 打包并压缩 |
| `tar -xzf 压缩包名.tar.gz` | 解压 |
| `zip -r 压缩包名.zip 目录` | 打包为 zip |
| `unzip 压缩包名.zip` | 解压 zip |

---

## 十、车上实战场景速查

### 场景 1：检查洗地车是否正常

```bash
ssh neardi@192.168.86.100
systemctl status can.service
systemctl status sweeper.service
pgrep mc_node
pgrep uss_node
ip link show can0
```

### 场景 2：服务崩了，重启并看日志

```bash
sudo systemctl restart sweeper.service
journalctl -u sweeper.service -n 50 --no-pager | grep -C 3 "ERROR"
```

### 场景 3：部署新版 start.sh

```bash
# 先备份
cp /home/neardi/sweeper_can_drivers/start.sh /home/neardi/sweeper_can_drivers/start.sh.bak.$(date +%Y%m%d_%H%M%S)
# 传文件（笔记本上操作）
scp start.sh neardi@192.168.86.100:/home/neardi/sweeper_can_drivers/
# 赋权并重启
ssh neardi@192.168.86.100 "chmod +x /home/neardi/sweeper_can_drivers/start.sh && sudo systemctl restart sweeper.service"
```

### 场景 4：排查控制模块有没有在跑

```bash
ssh root@192.168.86.11
pgrep control && echo "✅ control 运行中" || echo "❌ control 未运行"
tail -n 30 /etc/ulog/system.log | grep -E "ERROR|WARN"
```

---

> 📝 本文基于 2026-07-14 易成自动驾驶实习实战整理，收录的全部命令均已在实际部署场景中验证。持续更新中。
