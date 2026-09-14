import sys
import json
import re
import urllib.request
import urllib.parse

def verify_with_api_key(api_key: str, query: str):
    query = query.strip()
    is_handle = query.startswith("@")
    param = f"forHandle={urllib.parse.quote(query)}" if is_handle else f"id={urllib.parse.quote(query)}"
    url = f"https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&{param}&key={api_key}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EyeVideoPlatform/1.0"})
        resp = urllib.request.urlopen(req, timeout=8).read().decode("utf-8")
        data = json.loads(resp)
        items = data.get("items", [])
        if not items:
            return None
        item = items[0]
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        subs = stats.get("subscriberCount", "0")
        subs_fmt = f"{int(subs):,} subscribers" if subs.isdigit() else "verified channel"
        return {
            "success": True,
            "title": snippet.get("title", ""),
            "channelId": item.get("id", query),
            "handle": snippet.get("customUrl", query),
            "avatarUrl": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "subscriberCount": subs_fmt,
            "isVerified": True,
            "apiKeyValid": True
        }
    except Exception:
        return None

def lookup_channel(query: str, api_key: str = ""):
    query = query.strip()
    if not query:
        return {"success": False, "error": "Query cannot be empty"}

    if api_key:
        api_res = verify_with_api_key(api_key, query)
        if api_res:
            return api_res

    # Determine URL
    if query.startswith("@"):
        url = f"https://www.youtube.com/{query}"
    elif query.startswith("UC") and len(query) >= 20:
        url = f"https://www.youtube.com/channel/{query}"
    elif "youtube.com" in query:
        url = query
    else:
        url = f"https://www.youtube.com/@{query}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        html = urllib.request.urlopen(req, timeout=8).read().decode("utf-8", errors="ignore")

        # Extract title
        title_match = re.search(r'<title>(.*?)</title>', html)
        raw_title = title_match.group(1) if title_match else ""
        clean_title = raw_title.replace(" - YouTube", "").strip()

        # Extract channelId
        chid_match = re.search(r'\"externalId\":\"(.*?)\"', html) or re.search(r'\"browseId\":\"(.*?)\"', html)
        channel_id = chid_match.group(1) if chid_match else ""

        # Extract avatar
        avatar_match = re.search(r'\"avatar\":\{\"thumbnails\":\[\{\"url\":\"(.*?)\"', html)
        avatar_url = avatar_match.group(1) if avatar_match else ""

        # Extract handle
        handle_match = re.search(r'\"canonicalBaseUrl\":\"(.*?)\"', html)
        canonical_handle = handle_match.group(1).replace("/", "") if handle_match else query

        # Extract subscribers
        subs_match = re.search(r'\"subscriberCountText\":\{\"simpleText\":\"(.*?)\"\}', html)
        subscriber_count = subs_match.group(1) if subs_match else "verified channel"

        if not clean_title or clean_title == "YouTube":
            return {"success": False, "error": "Channel not found or private"}

        return {
            "success": True,
            "title": clean_title,
            "channelId": channel_id or query,
            "handle": canonical_handle if canonical_handle.startswith("@") else f"@{canonical_handle}",
            "avatarUrl": avatar_url,
            "subscriberCount": subscriber_count,
            "isVerified": True,
            "apiKeyValid": False if api_key else None
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing query argument"}))
        sys.exit(1)

    query_arg = sys.argv[1]
    api_key_arg = sys.argv[2] if len(sys.argv) > 2 else ""
    result = lookup_channel(query_arg, api_key_arg)
    print(json.dumps(result))
