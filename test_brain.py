import urllib.request
import json

BASE = "http://127.0.0.1:8001"

def get(path):
    r = urllib.request.urlopen(BASE + path)
    return json.loads(r.read())

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, data=body, headers={"Content-Type": "application/json"}, method="POST")
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

print("=== TEST 1: GET /api/health ===")
r = get("/api/health")
print("status:", r.get("status"))

print("\n=== TEST 2: POST /api/brain - Hello JARVIS ===")
r = post("/api/brain", {"message": "Hello JARVIS"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\n=== TEST 3: POST /api/brain - Search Google for GTA 6 ===")
r = post("/api/brain", {"message": "Search Google for GTA 6"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\n=== TEST 4: POST /api/brain - Open YouTube ===")
r = post("/api/brain", {"message": "open youtube"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\n=== TEST 5: POST /api/brain - Search YouTube for GTA 6 ===")
r = post("/api/brain", {"message": "search youtube for GTA 6"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\n=== TEST 6: POST /api/brain - Open Notepad ===")
r = post("/api/brain", {"message": "open notepad"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\n=== TEST 7: POST /api/brain - Open Calculator ===")
r = post("/api/brain", {"message": "open calculator"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\n=== TEST 8: POST /api/brain - Volume Up ===")
r = post("/api/brain", {"message": "turn the volume up"})
print("status:", r.get("status"), "| message:", r.get("message", "")[:80])

print("\nAll tests complete.")
