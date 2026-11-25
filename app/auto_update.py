#!/usr/bin/env python3
"""番茄实例二进制自动更新器（由 systemd timer 定时调用）。

流程：查最新 tag → 与本地版本比较 → 镜像回退下载 → 校验可执行 → 原子替换（留 .bak）
不改动正在运行的用户实例（下次启动时自然使用新二进制）。
"""
import json
import os
import re
import subprocess
import sys
import time

GITHUB_REPO = "zhongbai2333/Tomato-Novel-Downloader"
BIN = "/opt/tomato-multi/bin/tomato"
VER_FL = "/opt/tomato-multi/app/data/tomato_version.json"
LOCK = "/tmp/.tomato_autoupdate.lock"
LOG = "/opt/tomato-multi/app/auto_update.log"
MIRRORS = ["", "https://ghfast.top/", "https://gh-proxy.com/", "https://ghproxy.net/"]
MIN_INTERVAL = 3600  # 两次检查最小间隔（秒）
LAST_FL = "/opt/tomato-multi/app/data/.autoupdate_last"


def log(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    print(line)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        # 日志超过 512KB 时轮转
        if os.path.getsize(LOG) > 512 * 1024:
            os.replace(LOG, LOG + ".1")
    except Exception:
        pass


def current_version():
    try:
        with open(VER_FL, encoding="utf-8") as f:
            v = json.load(f).get("version", "")
        if v:
            return v
    except Exception:
        pass
    try:
        r = subprocess.run([BIN, "--version"], capture_output=True, text=True, timeout=10)
        m = re.search(r"v?\d+\.\d+\.\d+", r.stdout)
        return ("v" + m.group(0).lstrip("v")) if m else ""
    except Exception:
        return ""


def latest_tag():
    """优先 git ls-remote（无限流），失败回退 REST API。"""
    ver_pat = re.compile(r"^v\d+\.\d+\.\d+$")
    tags = set()
    try:
        r = subprocess.run(["git", "ls-remote", "--tags", f"https://github.com/{GITHUB_REPO}.git"],
                           capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            for line in r.stdout.splitlines():
                parts = line.split("\t")
                if len(parts) == 2:
                    t = parts[1].replace("refs/tags/", "").replace("^{}", "").strip()
                    if ver_pat.match(t):
                        tags.add(t)
    except Exception as e:
        log("git ls-remote 异常: %s" % e)

    if not tags:
        try:
            import urllib.request
            req = urllib.request.Request(
                f"https://api.github.com/repos/{GITHUB_REPO}/tags?per_page=50",
                headers={"User-Agent": "tomato-autoupdate"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                for it in json.load(resp):
                    if ver_pat.match(it["name"]):
                        tags.add(it["name"])
        except Exception as e:
            log("REST API 兜底失败: %s" % e)

    if not tags:
        return None

    def key(t):
        m = re.match(r"^v(\d+)\.(\d+)\.(\d+)", t)
        return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)
    return sorted(tags, key=key)[-1]


def download(tag):
    import urllib.request
    name = f"TomatoNovelDownloader-Linux_amd64-{tag}"
    url = f"https://github.com/{GITHUB_REPO}/releases/download/{tag}/{name}"
    tmp = "/tmp/tomato_auto_bin"
    for prefix in MIRRORS:
        target = prefix + url
        try:
            if prefix:
                log("尝试镜像 %s" % prefix)
            with urllib.request.urlopen(
                    urllib.request.Request(target, headers={"User-Agent": "tomato-autoupdate"}),
                    timeout=90) as resp, open(tmp, "wb") as f:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
            if os.path.getsize(tmp) < 1024 * 1024:
                raise RuntimeError("文件过小")
            os.chmod(tmp, 0o755)
            v = subprocess.run([tmp, "--version"], capture_output=True, text=True, timeout=15).stdout
            if not v.strip():
                raise RuntimeError("新二进制无法执行")
            log("下载成功(%s): %s" % (prefix or "直连", v.strip()))
            return tmp
        except Exception as e:
            log("下载失败 %s: %s" % (prefix or "直连", e))
            try:
                os.remove(tmp)
            except OSError:
                pass
    return None


def main():
    try:
        import fcntl
        fh = open(LOCK, "w")
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("已有更新进程在跑，跳过")
        return 0
    except Exception:
        fh = None

    # 频率限制
    try:
        last = float(open(LAST_FL).read().strip())
        if time.time() - last < MIN_INTERVAL:
            return 0
    except Exception:
        pass
    try:
        os.makedirs(os.path.dirname(LAST_FL), exist_ok=True)
        open(LAST_FL, "w").write(str(int(time.time())))
    except Exception:
        pass

    cur = current_version()
    tag = latest_tag()
    if not tag:
        log("无法获取最新版本，跳过")
        return 1
    log("本地=%s 最新=%s" % (cur or "unknown", tag))
    if cur == tag:
        return 0

    tmp = download(tag)
    if not tmp:
        log("所有下载源均失败，保留现有二进制")
        return 1

    # 备份 + 原子替换
    try:
        if os.path.isfile(BIN):
            import shutil
            shutil.copy2(BIN, BIN + ".bak")
        os.replace(tmp, BIN)
    except Exception as e:
        log("替换失败: %s" % e)
        return 1

    try:
        os.makedirs(os.path.dirname(VER_FL), exist_ok=True)
        json.dump({"version": tag, "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")},
                  open(VER_FL, "w", encoding="utf-8"), ensure_ascii=False)
    except Exception as e:
        log("写版本文件失败: %s" % e)

    log("已更新到 %s（原 %s），运行中的实例不受影响，下次启动使用新版" % (tag, cur or "unknown"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
