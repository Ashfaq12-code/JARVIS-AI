import os
import psutil
import time


def get_system_stats() -> dict:
    try:
        cpu = psutil.cpu_percent(interval=None)
        vmem = psutil.virtual_memory()

        if os.name == "nt":
            disk_root = os.environ.get("SystemDrive", "C:\\")
            disk_root = disk_root if disk_root.endswith("\\") else disk_root + "\\"
        else:
            disk_root = "/"

        disk = psutil.disk_usage(disk_root)

        return {
            "status": "success",
            "cpu": round(cpu, 1),
            "ram_percent": round(vmem.percent, 1),
            "ram_used_gb": round(vmem.used / (1024 ** 3), 2),
            "ram_total_gb": round(vmem.total / (1024 ** 3), 2),
            "disk_percent": round(disk.percent, 1),
            "platform": os.name,
            "uptime_seconds": max(0, int(time.time() - psutil.boot_time())),
            "network": "online" if any(stats.isup for stats in psutil.net_if_stats().values()) else "offline",
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }


def get_system_info() -> dict:
    stats = get_system_stats()
    if stats.get("status") != "success":
        return {"success": False, "tool": "system_info", "error": stats.get("message", "System information unavailable.")}
    return {"success": True, "status": "success", "tool": "system_info", "message": "System information read.", **stats}
