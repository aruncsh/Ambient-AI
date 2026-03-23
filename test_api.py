import urllib.request
req = urllib.request.Request("http://127.0.0.1:8001/api/v1/encounters/")
try:
    with urllib.request.urlopen(req) as f: print(f.read().decode())
except urllib.error.HTTPError as e: print("SERVER RETURNED:", e.read().decode())
