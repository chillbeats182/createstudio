"""
OreateAI - AI Video Motion Control Test
Educational Purpose Only

Workflow:
  1. Auth via cookies
  2. Get model/scene config
  3. Get GCS upload credentials (bucket + token)
  4. Upload character image + motion video to GCS
  5. Submit motion control video generation task
"""

import json
import time
import hashlib
import requests
import urllib3
import os
import base64
from urllib.parse import quote, urlencode

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================
# CONFIGURATION
# ============================================================
BASE_URL = "https://www.oreateai.com"
COOKIE_FILE = "/home/z/my-project/upload/json create ai.txt"
CHARACTER_IMAGE = "/home/z/my-project/upload/analyzed_video_task_face_swap_608617d891974e788552a32927003039_608617d891974e788552a32927003039_328.png"
MOTION_VIDEO = "/home/z/my-project/upload/WhatsApp Video 2026-06-08 at 12.57.46.mp4"
GCS_BASE = "https://storage.googleapis.com"

# Motion control prompt based on video analysis
MOTION_PROMPT = (
    "A woman dances rhythmically in a bedroom setting, starting with hands on hips, "
    "then lifting one arm upward, swinging both arms fluidly outward, tilting hips "
    "side-to-side in a playful sway, and finally raising both arms above her head. "
    "Movements include alternating left-right hip tilts creating a bounce effect, "
    "fluid expressive arm gestures (lifting, swinging, framing, stretching), subtle "
    "weight shifts with toe and heel lifts, and facial expressions progressing from "
    "neutral to joyful with smiling. Style: playful, energetic dance with loose, "
    "expressive body language."
)

# Model config from API (Kling 2.6, motion mode, 720p, 5s)
MODEL_CONFIG = {
    "modelName": "Kling 2.6",
    "sceneId": "motion",
    "duration": 5,
    "resolution": "720",
    "videoSize": "9:16",
    "aiType": 14172,  # motion 720p 3s from pointCostMotion
}


# ============================================================
# 1. LOAD COOKIES & CREATE SESSION
# ============================================================
def create_session():
    with open(COOKIE_FILE) as f:
        raw = json.load(f)
    cookies = {c["name"]: c["value"] for c in raw}

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.oreateai.com/home/vertical/aiVideo",
        "Origin": "https://www.oreateai.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
    })
    session.cookies.update(cookies)
    session.verify = False
    return session, cookies


# ============================================================
# 2. GET USER INFO & CREDITS
# ============================================================
def get_user_info(session):
    print("\n" + "=" * 60)
    print("  STEP 1: Get User Info")
    print("=" * 60)
    resp = session.get(f"{BASE_URL}/oreate/user/getuserinfo", timeout=15)
    data = resp.json()
    if data["status"]["code"] == 0:
        info = data["data"]["basicInfo"]
        vip = data["data"]["vipInfo"]
        print(f"  ✅ Email    : {info['email']}")
        print(f"  ✅ Is Login : {info['isLogin']}")
        print(f"  ✅ VIP Type : {vip['vipType']} (0=Free)")
        print(f"  ✅ VIP End  : {vip['etime'] or 'N/A'}")
        return True
    else:
        print(f"  ❌ Failed: {data['status']}")
        return False


# ============================================================
# 3. GET MODEL & SCENE CONFIG
# ============================================================
def get_model_config(session):
    print("\n" + "=" * 60)
    print("  STEP 2: Get Model & Scene Config")
    print("=" * 60)

    resp = session.get(f"{BASE_URL}/oreate/aivideo/getmodelconfigv3", timeout=15)
    model_data = resp.json()["data"]

    # Find Kling 2.6 motion config
    kling26 = None
    for m in model_data["models"]:
        if m["modelName"] == "Kling 2.6":
            kling26 = m
            break

    if kling26:
        print(f"  ✅ Model     : {kling26['modelName']}")
        motion_costs = kling26.get("pointCostMotion", [])
        for mc in motion_costs:
            if mc["resolution"] == "720":
                print(f"  ✅ Motion Cost: {mc['point']} credits ({mc['motDuration']}s motion, 720p)")
                print(f"  ✅ AI Type   : {mc['aiType']}")
                MODEL_CONFIG["aiType"] = mc["aiType"]
        print(f"  ✅ Sizes     : {[s['ratio'] for s in kling26.get('videoSize', [])]}")

    resp2 = session.get(f"{BASE_URL}/oreate/aivideo/getsceneconfig", timeout=15)
    scene_data = resp2.json()["data"]
    for s in scene_data["scenes"]:
        if s["sceneId"] == "motion":
            print(f"  ✅ Scene     : {s['sceneName']['en']} ({s['sceneId']})")

    return True


# ============================================================
# 4. GET GCS UPLOAD CREDENTIALS
# ============================================================
def get_upload_credentials(session, file_names):
    print("\n" + "=" * 60)
    print("  STEP 3: Get GCS Upload Credentials")
    print("=" * 60)

    # Build mFileList with actual file metadata (matching JS format)
    payload = {
        "mFileList": [
            {
                "name": fn,
                "size": os.path.getsize(os.path.join("/home/z/my-project/upload", fn)),
                "fileExt": fn.rsplit(".", 1)[-1] if "." in fn else "",
                "fileName": fn.rsplit(".", 1)[0] if "." in fn else fn,
            }
            for fn in file_names
        ]
    }

    resp = session.post(
        f"{BASE_URL}/oreate/convert/getuploadbostoken",
        json=payload,
        timeout=15
    )

    result = resp.json()
    print(f"  Status: {resp.status_code}")

    if result.get("status", {}).get("code") == 0:
        data = result["data"]
        key_list = data.get("KeyList", {})
        # Each file has its own bucket/objectPath/sessionkey
        first_key = list(key_list.keys())[0] if key_list else None
        bucket = key_list[first_key].get("bucket", "") if first_key else ""
        print(f"  ✅ Bucket   : {bucket}")

        credentials = {}
        for fn in file_names:
            if fn in key_list:
                info = key_list[fn]
                credentials[fn] = {
                    "bucket": info.get("bucket", bucket),
                    "objectPath": info.get("objectPath", fn),
                    "sessionkey": info.get("sessionkey", ""),
                }
                print(f"  ✅ {fn[:45]:45s}")
                print(f"     path: {credentials[fn]['objectPath'][:60]}")
        return credentials
    else:
        print(f"  ❌ Response: {json.dumps(result, indent=2)[:500]}")
        return None


# ============================================================
# 5. UPLOAD FILE TO GCS (Resumable Upload)
# =================================================<arg_value>
def upload_to_gcs(session, file_path, bucket, object_path, token):
    print(f"\n  📤 Uploading: {os.path.basename(file_path)}")
    print(f"     Size     : {os.path.getsize(file_path) / 1024 / 1024:.2f} MB")

    file_size = os.path.getsize(file_path)
    upload_url = f"{GCS_BASE}/upload/storage/v1/b/{bucket}/o?uploadType=resumable&name={quote(object_path, safe='')}"

    # Step 1: Initiate resumable upload
    print(f"     [1/3] Initiating resumable upload...")
    init_resp = session.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Content-Length": "0",
            "x-goog-user-project": "iron-area-433903-r2",
        },
        timeout=30,
        verify=False,
    )

    if init_resp.status_code not in [200, 201]:
        print(f"     ❌ Init failed: {init_resp.status_code}")
        print(f"        Body: {init_resp.text[:300]}")
        return None

    location = init_resp.headers.get("Location", "")
    upload_id = init_resp.headers.get("x-guploader-uploadid", "")
    print(f"     ✅ Location : {location[:80]}...")
    print(f"     ✅ UploadID : {upload_id[:40]}...")

    # Step 2: Upload the file
    print(f"     [2/3] Uploading file data...")

    with open(file_path, "rb") as f:
        file_data = f.read()

    if file_size < 5 * 1024 * 1024:
        # Small file - single PUT
        upload_resp = session.put(
            location,
            data=file_data,
            headers={
                "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                "Authorization": f"Bearer {token}",
                "x-goog-user-project": "iron-area-433903-r2",
            },
            timeout=120,
            verify=False,
        )
    else:
        # Large file - multipart upload
        chunk_size = 5 * 1024 * 1024
        upload_resp = _multipart_upload(session, file_data, bucket, object_path, token, chunk_size)

    print(f"     Status: {upload_resp.status_code}")

    if upload_resp.status_code in [200, 201]:
        # Extract final URL
        final_url = None
        try:
            result = upload_resp.json()
            final_url = result.get("selfLink") or result.get("mediaLink") or location
        except:
            final_url = f"https://storage.googleapis.com/{bucket}/{object_path}"

        print(f"     ✅ Upload complete!")
        print(f"     📁 URL: {final_url[:80]}...")
        return final_url
    else:
        print(f"     ❌ Upload failed: {upload_resp.text[:300]}")
        return None


def _multipart_upload(session, file_data, bucket, object_path, token, chunk_size):
    """Multipart upload for large files."""
    # Init multipart
    init_url = f"https://{bucket}.storage.googleapis.com/{object_path}?uploads"
    init_resp = session.post(
        init_url,
        headers={
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": "iron-area-433903-r2",
        },
        timeout=30,
        verify=False,
    )
    if init_resp.status_code != 200:
        return init_resp

    from xml.etree import ElementTree as ET
    root = ET.fromstring(init_resp.text)
    upload_id = root.text

    # Upload parts
    parts = []
    offset = 0
    part_num = 1
    while offset < len(file_data):
        chunk = file_data[offset:offset + chunk_size]
        part_url = f"https://{bucket}.storage.googleapis.com/{object_path}?partNumber={part_num}&uploadId={upload_id}"
        resp = session.put(
            part_url,
            data=chunk,
            headers={
                "Authorization": f"Bearer {token}",
                "x-goog-user-project": "iron-area-433903-r2",
            },
            timeout=120,
            verify=False,
        )
        etag = resp.headers.get("etag", "")
        parts.append(f'<Part><PartNumber>{part_num}</PartNumber><ETag>{etag}</ETag></Part>')
        offset += chunk_size
        part_num += 1
        print(f"       Part {part_num-1} uploaded...")

    # Complete multipart
    complete_url = f"https://{bucket}.storage.googleapis.com/{object_path}?uploadId={upload_id}"
    parts_xml = f"<CompleteMultipartUpload>{''.join(parts)}</CompleteMultipartUpload>"
    return session.post(
        complete_url,
        data=parts_xml.encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": "iron-area-433903-r2",
            "Content-Type": "application/xml",
        },
        timeout=30,
        verify=False,
    )


# ============================================================
# 6. SUBMIT MOTION CONTROL VIDEO TASK
# ============================================================
def submit_motion_task(session, character_url, motion_url, object_paths, credentials):
    print("\n" + "=" * 60)
    print("  STEP 5: Submit Motion Control Video Task")
    print("=" * 60)

    # Build attachments from uploaded files
    char_creds = credentials.get(os.path.basename(CHARACTER_IMAGE), {})
    video_creds = credentials.get(os.path.basename(MOTION_VIDEO), {})

    attachments = [
        {
            "bos_url": motion_url or f"https://storage.googleapis.com/{video_creds.get('bucket', '')}/{video_creds.get('objectPath', '')}",
            "fileName": os.path.basename(MOTION_VIDEO),
            "fileExt": "mp4",
            "size": os.path.getsize(MOTION_VIDEO),
            "doc_title": os.path.basename(MOTION_VIDEO),
            "doc_type": "mp4",
            "originSize": os.path.getsize(MOTION_VIDEO),
        },
        {
            "bos_url": character_url or f"https://storage.googleapis.com/{char_creds.get('bucket', '')}/{char_creds.get('objectPath', '')}",
            "fileName": os.path.basename(CHARACTER_IMAGE),
            "fileExt": "png",
            "size": os.path.getsize(CHARACTER_IMAGE),
            "doc_title": os.path.basename(CHARACTER_IMAGE),
            "doc_type": "png",
            "originSize": os.path.getsize(CHARACTER_IMAGE),
        },
    ]

    # Build request body based on JS analysis
    # toChat({mode, query, attachments, motion: {characterImage, motionVideo, motDuration, keepOriginalSound}})
    payload = {
        "mode": "chat_video",  # Ht[$e.CHAT_VIDEO] mapped value
        "query": MOTION_PROMPT,
        "attachments": attachments,
        "motion": {
            "characterImage": character_url or f"https://storage.googleapis.com/{char_creds.get('bucket', '')}/{char_creds.get('objectPath', '')}",
            "motionVideo": motion_url or f"https://storage.googleapis.com/{video_creds.get('bucket', '')}/{video_creds.get('objectPath', '')}",
            "motDuration": "3",
            "keepOriginalSound": False,
        },
        "htmlTplId": "",
        "videoConfig": {
            "sceneId": "motion",
            "modelName": "Kling 2.6",
            "duration": 5,
            "resolution": "720",
            "videoSize": "9:16",
            "aiType": MODEL_CONFIG["aiType"],
        },
    }

    print(f"  Model     : Kling 2.6")
    print(f"  Scene     : Motion Mimicry")
    print(f"  Duration  : 5s")
    print(f"  Resolution: 720p")
    print(f"  AI Type   : {MODEL_CONFIG['aiType']}")
    print(f"  Character : {os.path.basename(CHARACTER_IMAGE)}")
    print(f"  Motion Vid: {os.path.basename(MOTION_VIDEO)}")
    print(f"  Prompt    : {MOTION_PROMPT[:80]}...")

    print(f"\n  📤 Sending request to /oreate/create/chat ...")

    try:
        resp = session.post(
            f"{BASE_URL}/oreate/create/chat",
            json=payload,
            timeout=30,
            stream=True,
        )

        print(f"  Status: {resp.status_code}")
        print(f"  Headers: {dict(resp.headers)[:300] if resp.headers else 'N/A'}")

        # Read response (may be SSE stream)
        body = b""
        for chunk in resp.iter_content(chunk_size=1024):
            body += chunk
            if len(body) > 5000:
                break

        body_str = body.decode("utf-8", errors="replace")
        print(f"  Response ({len(body)} bytes):")
        print(f"  {body_str[:1000]}")

        # Try to parse as JSON
        try:
            result = json.loads(body_str)
            if result.get("status", {}).get("code") == 0:
                print(f"\n  ✅ TASK SUBMITTED SUCCESSFULLY!")
                if "data" in result:
                    print(f"  📋 Task Data: {json.dumps(result['data'], indent=2, ensure_ascii=False)[:500]}")
                return result
            else:
                print(f"  ⚠️  Error code: {result.get('status', {}).get('code')}")
                print(f"  Message: {result.get('status', {}).get('msg', 'N/A')}")
                return result
        except json.JSONDecodeError:
            print(f"  (Non-JSON response - may be SSE stream)")
            return {"raw_response": body_str[:500]}
    except Exception as e:
        print(f"  ❌ Request error: {e}")
        return None


# ============================================================
# 7. CHECK TASK STATUS (SSE)
# ============================================================
def check_task_status(session, doc_id=None):
    print("\n" + "=" * 60)
    print("  STEP 6: Check Task Status")
    print("=" * 60)

    if doc_id:
        resp = session.get(
            f"{BASE_URL}/oreate/doc/getstatus",
            params={"docIdList": doc_id},
            timeout=15,
        )
        print(f"  Status check: {resp.status_code}")
        try:
            print(f"  Response: {json.dumps(resp.json(), indent=2, ensure_ascii=False)[:500]}")
        except:
            print(f"  Body: {resp.text[:300]}")
    else:
        print("  No docId to check - task may need to be polled via SSE")


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  OreateAI - AI Video Motion Control Test")
    print("  Educational Purpose Only")
    print("=" * 60)
    print(f"  Character Image : {os.path.basename(CHARACTER_IMAGE)}")
    print(f"  Motion Video    : {os.path.basename(MOTION_VIDEO)}")
    print(f"  Model           : {MODEL_CONFIG['modelName']}")
    print(f"  Scene           : {MODEL_CONFIG['sceneId']}")

    # Verify files exist
    for f in [CHARACTER_IMAGE, MOTION_VIDEO, COOKIE_FILE]:
        if not os.path.exists(f):
            print(f"\n  ❌ File not found: {f}")
            return

    # Step 1: Create session
    session, cookies = create_session()
    print("\n  ✅ Session created with cookies")

    # Step 2: Get user info
    if not get_user_info(session):
        print("\n  ❌ Authentication failed!")
        return

    # Step 3: Get model config
    get_model_config(session)

    # Step 4: Get upload credentials
    char_name = os.path.basename(CHARACTER_IMAGE)
    video_name = os.path.basename(MOTION_VIDEO)
    credentials = get_upload_credentials(session, [char_name, video_name])

    if not credentials:
        print("\n  ❌ Failed to get upload credentials!")
        return

    # Step 5: Upload files
    print("\n" + "=" * 60)
    print("  STEP 4: Upload Files to GCS")
    print("=" * 60)

    char_creds = credentials.get(char_name, {})
    video_creds = credentials.get(video_name, {})

    # Upload character image
    character_url = None
    if char_creds:
        character_url = upload_to_gcs(
            session, CHARACTER_IMAGE,
            char_creds["bucket"], char_creds["objectPath"], char_creds["sessionkey"]
        )

    # Upload motion video
    motion_url = None
    if video_creds:
        motion_url = upload_to_gcs(
            session, MOTION_VIDEO,
            video_creds["bucket"], video_creds["objectPath"], video_creds["sessionkey"]
        )

    if not character_url and not motion_url:
        print("\n  ❌ Both uploads failed!")
        return

    # Step 6: Submit task
    result = submit_motion_task(session, character_url, motion_url, None, credentials)

    # Step 7: Check status
    if result and result.get("data"):
        doc_id = result["data"].get("docId") or result["data"].get("docID")
        if doc_id:
            time.sleep(2)
            check_task_status(session, doc_id)

    # Save results
    output = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "model_config": MODEL_CONFIG,
        "character_image": os.path.basename(CHARACTER_IMAGE),
        "motion_video": os.path.basename(MOTION_VIDEO),
        "character_url": character_url,
        "motion_url": motion_url,
        "prompt": MOTION_PROMPT,
        "task_result": result,
    }
    with open("/home/z/my-project/motion_test_result.json", "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'='*60}")
    print(f"  Results saved to: /home/z/my-project/motion_test_result.json")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()