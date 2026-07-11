"""
OreateAI Website Tester - Educational Purpose Only
Menguji halaman AI Video di oreateai.com menggunakan cookies sendiri.
"""

import json
import time
import requests
from urllib.parse import urljoin

# ============================================================
# CONFIGURATION
# ============================================================
BASE_URL = "https://www.oreateai.com"
COOKIE_FILE = "/home/z/my-project/upload/json create ai.txt"
TARGET_PAGE = "/home/vertical/aiVideo"

# ============================================================
# 1. LOAD COOKIES
# ============================================================
def load_cookies(filepath: str) -> dict:
    """Load cookies dari file JSON export browser."""
    with open(filepath, "r", encoding="utf-8") as f:
        raw_cookies = json.load(f)
    
    # Convert ke format {name: value} untuk requests
    cookie_dict = {}
    for c in raw_cookies:
        cookie_dict[c["name"]] = c["value"]
    
    print(f"[OK] Loaded {len(cookie_dict)} cookies from {filepath}")
    # Tampilkan cookie penting (non-tracking)
    important = ["ouss", "OUID", "_ga", "i18n_locale", "g_state"]
    for name in important:
        if name in cookie_dict:
            val = cookie_dict[name][:50] + "..." if len(cookie_dict[name]) > 50 else cookie_dict[name]
            print(f"     {name} = {val}")
    return cookie_dict

# ============================================================
# 2. CREATE SESSION
# ============================================================
def create_session(cookies: dict) -> requests.Session:
    """Buat requests session dengan cookies."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
    })
    session.cookies.update(cookies)
    return session

# ============================================================
# 3. TEST FUNCTIONS
# ============================================================
def test_homepage(session: requests.Session) -> dict:
    """Test halaman utama."""
    print("\n" + "="*60)
    print("TEST 1: Homepage")
    print("="*60)
    
    url = BASE_URL
    start = time.time()
    resp = session.get(url, allow_redirects=True, timeout=30)
    elapsed = time.time() - start
    
    result = {
        "url": url,
        "status_code": resp.status_code,
        "response_time_ms": round(elapsed * 1000),
        "content_length": len(resp.text),
        "redirects": len(resp.history),
        "final_url": resp.url,
    }
    
    print(f"  URL         : {url}")
    print(f"  Status      : {resp.status_code} {'✓' if resp.status_code == 200 else '✗'}")
    print(f"  Response    : {result['response_time_ms']}ms")
    print(f"  Size        : {result['content_length']} chars")
    print(f"  Redirects   : {result['redirects']}")
    print(f"  Final URL   : {resp.url}")
    
    # Check login indicators
    title_tag = ""
    if "<title>" in resp.text:
        title_tag = resp.text.split("<title>")[1].split("</title>")[0].strip()
    print(f"  Title       : {title_tag}")
    
    return result

def test_ai_video_page(session: requests.Session) -> dict:
    """Test halaman AI Video."""
    print("\n" + "="*60)
    print("TEST 2: AI Video Page")
    print("="*60)
    
    url = urljoin(BASE_URL, TARGET_PAGE)
    start = time.time()
    resp = session.get(url, allow_redirects=True, timeout=30)
    elapsed = time.time() - start
    
    result = {
        "url": url,
        "status_code": resp.status_code,
        "response_time_ms": round(elapsed * 1000),
        "content_length": len(resp.text),
        "redirects": len(resp.history),
        "final_url": resp.url,
    }
    
    print(f"  URL         : {url}")
    print(f"  Status      : {resp.status_code} {'✓' if resp.status_code == 200 else '✗'}")
    print(f"  Response    : {result['response_time_ms']}ms")
    print(f"  Size        : {result['content_length']} chars")
    print(f"  Redirects   : {result['redirects']}")
    print(f"  Final URL   : {resp.url}")
    
    # Check untuk redirect ke login page
    if "/login" in resp.url or "/userlogin" in resp.url:
        print("  [!] REDIRECTED TO LOGIN - Cookies mungkin expired")
        result["auth_valid"] = False
    else:
        print("  [✓] Page loaded (no login redirect)")
        result["auth_valid"] = True
    
    # Check konten halaman
    page_text = resp.text
    
    # Cek elemen kunci dari screenshot
    checks = {
        "AI Video text": "AI Video" in page_text or "aiVideo" in page_text,
        "Motion Mimicry": "Motion Mimicry" in page_text or "motion" in page_text.lower(),
        "Kling model": "Kling" in page_text or "kling" in page_text.lower(),
        "720P option": "720P" in page_text or "720p" in page_text,
        "Credits text": "Credit" in page_text or "credit" in page_text.lower(),
        "Add Motion btn": "Add Motion" in page_text or "addMotion" in page_text or "add-motion" in page_text.lower(),
        "Character btn": "Character" in page_text or "character" in page_text.lower(),
    }
    
    print("\n  Content Checks:")
    for check_name, passed in checks.items():
        symbol = "✓" if passed else "✗"
        print(f"    {symbol} {check_name}")
    
    result["content_checks"] = checks
    
    # Check title
    if "<title>" in page_text:
        title = page_text.split("<title>")[1].split("</title>")[0].strip()
        print(f"\n  Page Title  : {title}")
        result["title"] = title
    
    return result

def test_api_user_info(session: requests.Session) -> dict:
    """Test API endpoint untuk info user."""
    print("\n" + "="*60)
    print("TEST 3: User Info API Check")
    print("="*60)
    
    # Coba beberapa endpoint umum
    api_endpoints = [
        "/api/user/info",
        "/api/user/profile",
        "/api/v1/user/info",
        "/api/user/getInfo",
        "/api/account/info",
    ]
    
    results = {}
    for endpoint in api_endpoints:
        url = urljoin(BASE_URL, endpoint)
        try:
            start = time.time()
            resp = session.get(url, timeout=10)
            elapsed = time.time() - start
            
            status_icon = "✓" if resp.status_code == 200 else "—"
            body_preview = resp.text[:200] if resp.text else "(empty)"
            
            results[endpoint] = {
                "status": resp.status_code,
                "time_ms": round(elapsed * 1000),
                "body_preview": body_preview,
            }
            
            print(f"  {endpoint}")
            print(f"    Status : {resp.status_code} {status_icon}  ({elapsed*1000:.0f}ms)")
            print(f"    Body   : {body_preview[:150]}...")
            
            # Jika dapat 200, coba parse JSON
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    print(f"    JSON   : {json.dumps(data, indent=6)[:200]}")
                except:
                    pass
            print()
            
        except requests.exceptions.Timeout:
            print(f"  {endpoint} → TIMEOUT")
            results[endpoint] = {"status": "timeout"}
        except Exception as e:
            print(f"  {endpoint} → ERROR: {e}")
            results[endpoint] = {"status": "error", "error": str(e)}
    
    return results

def test_api_ai_video(session: requests.Session) -> dict:
    """Test API endpoint AI Video."""
    print("\n" + "="*60)
    print("TEST 4: AI Video API Endpoints")
    print("="*60)
    
    api_endpoints = [
        ("/api/ai/video/config", "GET"),
        ("/api/aiVideo/config", "GET"),
        ("/api/video/models", "GET"),
        ("/api/ai/video/models", "GET"),
        ("/api/aiVideo/modelList", "GET"),
    ]
    
    results = {}
    for endpoint, method in api_endpoints:
        url = urljoin(BASE_URL, endpoint)
        try:
            start = time.time()
            resp = session.get(url, timeout=10)
            elapsed = time.time() - start
            
            status_icon = "✓" if resp.status_code == 200 else "—"
            body_preview = resp.text[:200] if resp.text else "(empty)"
            
            results[endpoint] = {
                "method": method,
                "status": resp.status_code,
                "time_ms": round(elapsed * 1000),
                "body_preview": body_preview,
            }
            
            print(f"  [{method}] {endpoint}")
            print(f"    Status : {resp.status_code} {status_icon}  ({elapsed*1000:.0f}ms)")
            print(f"    Body   : {body_preview[:150]}")
            
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    print(f"    JSON   : {json.dumps(data, indent=6)[:200]}")
                except:
                    pass
            print()
            
        except requests.exceptions.Timeout:
            print(f"  [{method}] {endpoint} → TIMEOUT\n")
            results[endpoint] = {"status": "timeout"}
        except Exception as e:
            print(f"  [{method}] {endpoint} → ERROR: {e}\n")
            results[endpoint] = {"status": "error", "error": str(e)}
    
    return results

def test_credit_balance(session: requests.Session) -> dict:
    """Test endpoint balance/credits."""
    print("\n" + "="*60)
    print("TEST 5: Credit/Balance Check")
    print("="*60)
    
    endpoints = [
        "/api/user/credits",
        "/api/user/balance",
        "/api/credits/balance",
        "/api/aiVideo/quota",
        "/api/user/quota",
    ]
    
    results = {}
    for endpoint in endpoints:
        url = urljoin(BASE_URL, endpoint)
        try:
            resp = session.get(url, timeout=10)
            status_icon = "✓" if resp.status_code == 200 else "—"
            body = resp.text[:200] if resp.text else "(empty)"
            
            results[endpoint] = {
                "status": resp.status_code,
                "body_preview": body,
            }
            
            print(f"  {endpoint} → {resp.status_code} {status_icon}")
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    print(f"    Response: {json.dumps(data, indent=6)[:200]}")
                except:
                    print(f"    Response: {body[:150]}")
            
        except Exception as e:
            print(f"  {endpoint} → ERROR: {e}")
            results[endpoint] = {"status": "error"}
    
    return results

# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  OreateAI Website Tester")
    print("  Target: AI Video Page")
    print("  Purpose: Educational Testing Only")
    print("=" * 60)
    
    # Load cookies
    cookies = load_cookies(COOKIE_FILE)
    
    # Create session
    session = create_session(cookies)
    
    # Run tests
    all_results = {}
    
    # Test 1: Homepage
    all_results["homepage"] = test_homepage(session)
    
    # Test 2: AI Video Page
    all_results["ai_video_page"] = test_ai_video_page(session)
    
    # Test 3: User Info API
    all_results["user_api"] = test_api_user_info(session)
    
    # Test 4: AI Video API
    all_results["ai_video_api"] = test_api_ai_video(session)
    
    # Test 5: Credits
    all_results["credits"] = test_credit_balance(session)
    
    # Summary
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    
    hp = all_results["homepage"]
    av = all_results["ai_video_page"]
    
    print(f"  Homepage Status    : {hp['status_code']} ({hp['response_time_ms']}ms)")
    print(f"  AI Video Page      : {av['status_code']} ({av['response_time_ms']}ms)")
    print(f"  Auth Valid         : {'✓ Yes' if av.get('auth_valid') else '✗ No (redirected to login)'}")
    
    if av.get("content_checks"):
        passed = sum(1 for v in av["content_checks"].values() if v)
        total = len(av["content_checks"])
        print(f"  Content Checks     : {passed}/{total} passed")
    
    print(f"\n  Full results saved to: /home/z/my-project/test_results.json")
    
    # Save results
    # Convert non-serializable types
    def make_serializable(obj):
        if isinstance(obj, dict):
            return {k: make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [make_serializable(i) for i in obj]
        elif isinstance(obj, bool):
            return obj
        return str(obj)
    
    with open("/home/z/my-project/test_results.json", "w", encoding="utf-8") as f:
        json.dump(make_serializable(all_results), f, indent=2, ensure_ascii=False)
    
    print("\n  Done!")

if __name__ == "__main__":
    main()