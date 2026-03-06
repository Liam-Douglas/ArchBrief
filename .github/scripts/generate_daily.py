#!/usr/bin/env python3
"""
ArchBrief Daily Brief Generator v2
Runs via GitHub Actions every morning at 5am AEST.

Features:
  - Reads feedback.json  → weights topics/vendors by your ratings
  - Reads projects.json  → surfaces news relevant to active projects
  - Reads history.json   → avoids repeating stories from past 7 days
  - Writes history.json  → tracks what was covered today
  - Friday: generates weekly_summary.json + sends email digest
  - Daily: checks APS status diff → alerts on changes
"""

import json, os, sys, time, smtplib, requests
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo
from pathlib import Path

# ── CONFIG ─────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SMTP_HOST         = os.environ.get("SMTP_HOST", "")
SMTP_PORT         = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER         = os.environ.get("SMTP_USER", "")
SMTP_PASS         = os.environ.get("SMTP_PASS", "")
EMAIL_TO          = os.environ.get("EMAIL_TO", "")
EMAIL_CC          = os.environ.get("EMAIL_CC", "")

MODEL = "claude-sonnet-4-20250514"
DATA_DIR = Path("data")
AEST  = ZoneInfo("Australia/Sydney")

VENDORS     = ["AWS","IBM","Microsoft Azure","Oracle Cloud","Salesforce",
               "ServiceNow","Palo Alto Networks","HashiCorp / Terraform","Emerging Startups"]
VENDOR_KEYS = ["aws","ibm","azure","oracle","salesforce",
               "servicenow","paloalto","hashicorp","emerging"]

APS = """Australian Public Sector context:
- ISM/IRAP assessment status per vendor
- Protective markings: OFFICIAL, PROTECTED, PROTECTED-CABINET
- DTA cloud policy alignment
- Data sovereignty and onshore Australian hosting
- WoG platforms: myGov, ATO, Services Australia, Digital ID"""

VENDOR_COLORS = {
    "aws":"#ff9900","ibm":"#4589ff","azure":"#0078d4","oracle":"#f80000",
    "salesforce":"#00a1e0","servicenow":"#62d84e","paloalto":"#ef5925",
    "hashicorp":"#7b42bc","emerging":"#ffd700"
}

# ── CLAUDE API ──────────────────────────────────────
def call_claude(messages, system, retries=3):
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set")
    headers = {"Content-Type":"application/json",
               "x-api-key":ANTHROPIC_API_KEY,
               "anthropic-version":"2023-06-01"}
    payload = {"model":MODEL,"max_tokens":1000,"system":system,
               "tools":[{"type":"web_search_20250305","name":"web_search"}],
               "messages":messages}
    for attempt in range(retries):
        try:
            print(f"    → Claude API (attempt {attempt+1})...")
            r = requests.post("https://api.anthropic.com/v1/messages",
                              headers=headers, json=payload, timeout=120)
            r.raise_for_status()
            d = r.json()
            if "error" in d: raise ValueError(d["error"])
            return "\n".join(b["text"] for b in d.get("content",[]) if b.get("type")=="text")
        except Exception as e:
            print(f"    ⚠ Attempt {attempt+1}: {e}")
            if attempt < retries-1: time.sleep(12*(attempt+1))
    raise RuntimeError(f"Claude API failed after {retries} attempts")

def parse_json(raw):
    c = raw.strip()
    if c.startswith("```"):
        lines = c.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].strip()=="```": lines = lines[:-1]
        c = "\n".join(lines).strip()
    return json.loads(c)

# ── CONTEXT LOADERS ─────────────────────────────────
def load_feedback():
    try:
        with open(DATA_DIR / "feedback.json") as f: fb = json.load(f)
        ratings = fb.get("ratings", [])
        cutoff  = datetime.now() - timedelta(days=30)
        recent  = []
        for r in ratings:
            try:
                if datetime.fromisoformat(r.get("ratedAt","2000-01-01")) >= cutoff:
                    recent.append(r)
            except: recent.append(r)
        vendor_scores, topic_scores = {}, {}
        for r in recent:
            score = 1 if r.get("rating")=="up" else -1
            for v in r.get("vendors",[]): vendor_scores[v] = vendor_scores.get(v,0)+score
            t = r.get("topicTag","")
            if t: topic_scores[t] = topic_scores.get(t,0)+score
        def to_inst(scores):
            out = {}
            for k,v in scores.items():
                if v>=3:  out[k]="HIGH — user loves this, prioritise"
                elif v>=1: out[k]="MEDIUM — user likes this"
                elif v<=-3: out[k]="LOW — user dislikes this, deprioritise"
                elif v<=-1: out[k]="REDUCE — user has downvoted"
            return out
        total = len(recent)
        ups   = sum(1 for r in recent if r.get("rating")=="up")
        summary = f"{total} ratings ({ups} up, {total-ups} down)"
        print(f"  ✓ Feedback: {summary}")
        return {"topicBoosts":to_inst(topic_scores),"vendorBoosts":to_inst(vendor_scores),"summary":summary}
    except FileNotFoundError:
        print("  ℹ No feedback.json yet")
        return {"topicBoosts":{},"vendorBoosts":{},"summary":"No feedback yet"}
    except Exception as e:
        print(f"  ⚠ Feedback error: {e}")
        return {"topicBoosts":{},"vendorBoosts":{},"summary":f"Error: {e}"}

def load_projects():
    try:
        with open("projects.json") as f: data = json.load(f)
        active  = [p for p in data.get("projects",[]) if p.get("active",True)]
        focus   = data.get("focusAreas",[])
        weights = {k:v for k,v in data.get("vendorWeights",{}).items() if k!="_note" and v!=1}
        role    = data.get("role","Solution Architect")
        print(f"  ✓ Projects: {len(active)} active")
        for p in active: print(f"    • {p['name']}")
        return {"role":role,"active":active,"focus":focus,"weights":weights}
    except FileNotFoundError:
        print("  ℹ No projects.json")
        return {"role":"Solution Architect","active":[],"focus":[],"weights":{}}
    except Exception as e:
        print(f"  ⚠ Projects error: {e}")
        return {"role":"Solution Architect","active":[],"focus":[],"weights":{}}

def load_history(days=7):
    try:
        with open(DATA_DIR / "history.json") as f: data = json.load(f)
        cutoff = datetime.now(AEST) - timedelta(days=days)
        recent = [e for e in data.get("entries",[])
                  if datetime.fromisoformat(e.get("date","2000-01-01")).replace(tzinfo=None)
                  >= cutoff.replace(tzinfo=None)]
        titles, vendor_counts = [], {}
        for e in recent:
            for a in e.get("articles",[]):
                titles.append(a.get("title",""))
                for v in a.get("vendors",[]): vendor_counts[v] = vendor_counts.get(v,0)+1
        print(f"  ✓ History: {len(titles)} articles from last {days} days")
        return {"coveredTitles":titles[-40:],"vendorCoverage":vendor_counts,"recentCount":len(recent)}
    except FileNotFoundError:
        print("  ℹ No history.json yet — first run")
        return {"coveredTitles":[],"vendorCoverage":{},"recentCount":0}
    except Exception as e:
        print(f"  ⚠ History error: {e}")
        return {"coveredTitles":[],"vendorCoverage":{},"recentCount":0}

def update_history(date_key, date_str, articles):
    try:
        try:
            with open(DATA_DIR / "history.json") as f: data = json.load(f)
        except FileNotFoundError:
            data = {"entries":[]}
        cutoff = datetime.now(AEST) - timedelta(days=30)
        data["entries"] = [
            e for e in data.get("entries",[])
            if datetime.fromisoformat(e.get("date","2000-01-01")).replace(tzinfo=None)
            >= cutoff.replace(tzinfo=None)
            and e.get("dateKey") != date_key
        ]
        data["entries"].append({
            "dateKey": date_key, "date": date_str,
            "articles":[{"title":a.get("title",""),"vendors":a.get("vendors",[]),
                         "topicTag":a.get("topicTag","")} for a in articles]
        })
        with open(DATA_DIR / "history.json","w") as f: json.dump(data,f,indent=2)
        print(f"  ✓ history.json updated ({len(data['entries'])} days)")
    except Exception as e:
        print(f"  ⚠ History update error: {e}")

def build_context(feedback, projects, history):
    parts = []
    active = projects.get("active",[])
    if active:
        parts.append("ACTIVE PROJECTS — surface relevant news:")
        for p in active:
            parts.append(f"  • {p['name']}: {p['description']}"
                         f" | Vendors: {', '.join(p.get('vendors',[]))}"
                         f" | APS level: {p.get('apsClassification','OFFICIAL')}"
                         f" | Topics: {', '.join(p.get('topics',[]))}")
    if projects.get("focus"):
        parts.append(f"\nFOCUS AREAS: {', '.join(projects['focus'])}")
    if projects.get("weights"):
        parts.append(f"\nVENDOR WEIGHT OVERRIDES: {projects['weights']}")
    vb = feedback.get("vendorBoosts",{})
    tb = feedback.get("topicBoosts",{})
    if vb: parts.append(f"\nUSER FEEDBACK — VENDORS:\n" + "\n".join(f"  • {k}: {v}" for k,v in vb.items()))
    if tb: parts.append(f"\nUSER FEEDBACK — TOPICS:\n" + "\n".join(f"  • {k}: {v}" for k,v in tb.items()))
    covered = history.get("coveredTitles",[])
    if covered:
        parts.append(f"\nRECENTLY COVERED — do not repeat these stories:")
        for t in covered[-20:]: parts.append(f"  • {t}")
    vc = history.get("vendorCoverage",{})
    if vc:
        over  = [k for k,v in vc.items() if v>=4]
        under = [k for k in VENDOR_KEYS if vc.get(k,0)==0]
        if over:  parts.append(f"\nOVER-COVERED THIS WEEK (reduce): {', '.join(over)}")
        if under: parts.append(f"\nUNDER-COVERED THIS WEEK (include): {', '.join(under)}")
    return "\n".join(parts) if parts else "No personalisation yet — equal coverage."

# ── GENERATORS ──────────────────────────────────────
def gen_digest(date_str, context):
    print("\n📰 Generating digest...")
    vl = ", ".join(VENDORS)
    system = f"""You are ArchBrief — daily IT intelligence for an Assistant Solution Architect at IBM, Australian Public Sector.
Today: {date_str} Sydney Australia. Vendors: {vl}
{APS}

PERSONALISATION — follow carefully:
{context}

Search web for latest news past 48 hours. Return ONLY valid JSON:
{{"summary":"2-sentence overview","apsAlert":"APS alert or null","articles":[{{"title":"string","vendors":["key"],"topicTag":"arch|security|ai|devops|industry","lead":"string","body":"4-5 paragraphs technical depth","arch_impact":"3-4 sentences architect implications","key_points":["p1","p2","p3","p4"],"apsRelevance":"string or null"}}]}}
Generate exactly 7 articles. Follow personalisation above."""
    raw  = call_claude([{"role":"user","content":f"Generate today's brief {date_str}. Search latest news."}], system)
    data = parse_json(raw)
    print(f"  ✓ {len(data.get('articles',[]))} articles")
    return data

def gen_aps(date_str):
    print("\n🇦🇺 Generating APS radar...")
    system = f"""Australian Government ICT compliance expert. Today: {date_str} Sydney.
Search for latest IRAP assessments, DTA policy, protective marking status.
Return ONLY valid JSON:
{{"lastUpdated":"{date_str}","keyAlerts":["a1","a2","a3"],
"irapStatus":[{{"vendor":"string","service":"string","status":"assessed|in-progress|not-assessed","level":"OFFICIAL|PROTECTED|unknown","notes":"string","color":"green|yellow|gray"}}],
"protectiveMarkings":[{{"marking":"OFFICIAL|PROTECTED|PROTECTED-CABINET","description":"string","vendorsSupported":["keys"]}}],
"dtaAlignment":[{{"vendor":"string","status":"aligned|partial|unknown","detail":"string"}}],
"sovereignty":[{{"vendor":"string","australianRegions":["string"],"dataResidency":"guaranteed|configurable|unknown","notes":"string"}}],
"wogPlatforms":[{{"name":"string","agency":"string","technology":"string","vendors":["string"],"notes":"string"}}]}}"""
    raw  = call_claude([{"role":"user","content":f"Latest IRAP, DTA, APS compliance {date_str}."}], system)
    data = parse_json(raw)
    print(f"  ✓ {len(data.get('irapStatus',[]))} vendors, {len(data.get('keyAlerts',[]))} alerts")
    return data

def gen_explorer(date_str, context):
    print("\n🗂 Generating explorer...")
    vl = ", ".join(VENDORS)
    system = f"""ArchBrief explorer for APS Solution Architect. Vendors: {vl}. Date: {date_str}.
PERSONALISATION: {context}
Search current news. Return ONLY valid JSON:
{{"articles":[{{"navTitle":"3 words","title":"string","vendors":["key"],"topicTag":"arch|security|ai|devops|industry","lead":"string","sections":[{{"heading":"string","content":"2-3 paragraphs"}}],"arch_impact":"string","apsRelevance":"string or null"}}]}}
5 articles. Follow personalisation."""
    raw  = call_claude([{"role":"user","content":f"Build explorer {date_str}. Vendors: {vl}."}], system)
    data = parse_json(raw)
    print(f"  ✓ {len(data.get('articles',[]))} explorer articles")
    return data

# ── APS CHANGE DETECTION ────────────────────────────
def detect_aps_changes(new_aps):
    """Compare today's APS radar to yesterday's — surface changes."""
    changes = []
    try:
        with open(DATA_DIR / "daily.json") as f: prev = json.load(f)
        prev_aps = prev.get("aps", {})
        prev_irap = {e.get("vendor",""):e for e in prev_aps.get("irapStatus",[])}
        for entry in new_aps.get("irapStatus",[]):
            vendor = entry.get("vendor","")
            if vendor in prev_irap:
                old = prev_irap[vendor]
                if old.get("status") != entry.get("status") or old.get("level") != entry.get("level"):
                    changes.append({
                        "type":   "irap_change",
                        "vendor": vendor,
                        "from":   f"{old.get('status')} / {old.get('level')}",
                        "to":     f"{entry.get('status')} / {entry.get('level')}",
                        "notes":  entry.get("notes","")
                    })
        prev_alerts = set(prev_aps.get("keyAlerts",[]))
        new_alerts  = set(new_aps.get("keyAlerts",[]))
        for alert in new_alerts - prev_alerts:
            changes.append({"type":"new_alert","alert":alert})
    except (FileNotFoundError, KeyError):
        pass
    if changes:
        print(f"  🔔 APS changes detected: {len(changes)}")
        for c in changes: print(f"    • {c}")
    else:
        print("  ✓ No APS changes from yesterday")
    return changes

# ── WEEKLY SUMMARY ──────────────────────────────────
def gen_weekly(date_str, history, feedback):
    print("\n📋 Generating weekly summary...")
    covered = history.get("coveredTitles",[])
    vc      = history.get("vendorCoverage",{})
    system = f"""ArchBrief Friday weekly summary for APS Solution Architect at IBM.
Return ONLY valid JSON:
{{"weekHeadline":"punchy 1-sentence week summary",
"topStories":[{{"title":"string","why":"architect relevance","vendors":["key"]}}],
"vendorHighlights":[{{"vendor":"string","highlight":"key development this week"}}],
"apsWeekly":"2-3 sentences most important APS IT development",
"nextWeekWatch":["watch 1","watch 2","watch 3"],
"weekStats":{{"articlesGenerated":{len(covered)},"vendorBreakdown":{json.dumps(vc)},"feedbackSummary":"{feedback.get('summary','—')}"}}}}"""
    raw  = call_claude([{"role":"user","content":f"Weekly summary week ending {date_str}. Articles: {', '.join(covered[-20:])}."}], system)
    data = parse_json(raw)
    print("  ✓ Weekly summary generated")
    return data

def build_email_html(weekly, date_str):
    def _vendor_badges(vendors):
        parts = []
        for v in vendors:
            bg = VENDOR_COLORS.get(v, "#333")
            fg = VENDOR_COLORS.get(v, "#8aa4bc")
            parts.append(
                f'<span style="font-size:9px;padding:2px 7px;border-radius:2px;'
                f'background:{bg}20;color:{fg};font-family:monospace">{v.upper()}</span>'
            )
        return " ".join(parts)

    stories_html = "".join(
        f'<tr><td style="padding:12px 16px;border-bottom:1px solid #1c2a3e">'
        f'<div style="font-size:14px;font-weight:600;color:#dce8f4;margin-bottom:4px">{s["title"]}</div>'
        f'<div style="font-size:12px;color:#8aa4bc;line-height:1.5">{s["why"]}</div>'
        f'<div style="margin-top:5px">{_vendor_badges(s.get("vendors",[]))}</div>'
        f'</td></tr>'
        for s in weekly.get("topStories",[])
    )
    vendor_html = "".join(
        f'<tr><td style="padding:10px 16px;border-bottom:1px solid #1c2a3e">'
        f'<span style="font-size:10px;font-family:monospace;color:{VENDOR_COLORS.get(v["vendor"].lower().replace(" ","").replace("/",""),"#22ffa8")};font-weight:600">{v["vendor"].upper()}</span>'
        f'<span style="font-size:12px;color:#8aa4bc;margin-left:10px">{v["highlight"]}</span>'
        f'</td></tr>'
        for v in weekly.get("vendorHighlights",[])
    )
    watch_html = "".join(f'<li style="margin-bottom:6px;color:#8aa4bc;font-size:13px">{w}</li>' for w in weekly.get("nextWeekWatch",[]))
    stats = weekly.get("weekStats",{})
    vc_html = " &middot; ".join(
        f'<span style="color:{VENDOR_COLORS.get(k,"#8aa4bc")}">{k.upper()} {v}</span>'
        for k,v in stats.get("vendorBreakdown",{}).items()
    )
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ArchBrief Weekly — {date_str}</title></head>
<body style="margin:0;padding:0;background:#060810;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:linear-gradient(135deg,#0a0d14,#141c2a);border:1px solid #1c2a3e;border-radius:10px;padding:24px;margin-bottom:16px;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">🏛</div>
    <div style="font-size:24px;font-weight:800;color:#22ffa8;letter-spacing:-0.5px">ArchBrief Weekly</div>
    <div style="font-size:12px;color:#4a6278;font-family:monospace;margin-top:4px;letter-spacing:1.5px">{date_str.upper()}</div>
    <div style="margin-top:14px;font-size:15px;color:#dce8f4;line-height:1.6;font-style:italic">{weekly.get('weekHeadline','')}</div>
  </div>
  <div style="background:#0a0d14;border:1px solid #1c2a3e;border-radius:8px;overflow:hidden;margin-bottom:14px">
    <div style="padding:12px 16px;background:#0f1420;border-bottom:1px solid #1c2a3e"><span style="font-size:10px;font-family:monospace;color:#4a6278;text-transform:uppercase;letter-spacing:1.5px">Top Stories</span></div>
    <table width="100%" cellpadding="0" cellspacing="0">{stories_html}</table>
  </div>
  <div style="background:#0a0d14;border:1px solid rgba(0,132,61,.25);border-radius:8px;padding:16px;margin-bottom:14px">
    <div style="font-size:10px;font-family:monospace;color:#00843d;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">🇦🇺 Australian Public Sector</div>
    <div style="font-size:13px;color:rgba(0,200,100,.8);line-height:1.65">{weekly.get('apsWeekly','')}</div>
  </div>
  <div style="background:#0a0d14;border:1px solid #1c2a3e;border-radius:8px;overflow:hidden;margin-bottom:14px">
    <div style="padding:12px 16px;background:#0f1420;border-bottom:1px solid #1c2a3e"><span style="font-size:10px;font-family:monospace;color:#4a6278;text-transform:uppercase;letter-spacing:1.5px">Vendor Highlights</span></div>
    <table width="100%" cellpadding="0" cellspacing="0">{vendor_html}</table>
  </div>
  <div style="background:#0a0d14;border:1px solid #1c2a3e;border-radius:8px;padding:16px;margin-bottom:14px">
    <div style="font-size:10px;font-family:monospace;color:#4a6278;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Next Week — Watch For</div>
    <ul style="margin:0;padding-left:18px">{watch_html}</ul>
  </div>
  <div style="background:#0a0d14;border:1px solid #1c2a3e;border-radius:8px;padding:14px 16px;margin-bottom:14px">
    <div style="font-size:10px;font-family:monospace;color:#4a6278;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Week in Numbers</div>
    <div style="font-size:12px;color:#8aa4bc;margin-bottom:5px">{stats.get('articlesGenerated',0)} articles generated</div>
    <div style="font-size:11px;font-family:monospace">{vc_html}</div>
    <div style="font-size:11px;color:#4a6278;margin-top:6px">Feedback: {stats.get('feedbackSummary','—')}</div>
  </div>
  <div style="text-align:center;padding:16px 0;font-size:11px;color:#2a3a4e;font-family:monospace">
    ArchBrief v4 · Auto-generated 5:00am AEST every Friday<br>
    Unclassified only · Do not forward PROTECTED content
  </div>
</div>
</body></html>"""

def send_email(html, date_str):
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_TO]):
        print("  ℹ Email not configured — weekly_summary.json saved, no email sent")
        print("    Add GitHub Secrets: SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_TO")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"ArchBrief Weekly — {date_str}"
        msg["From"]    = f"ArchBrief <{SMTP_USER}>"
        msg["To"]      = EMAIL_TO
        if EMAIL_CC: msg["Cc"] = EMAIL_CC
        msg.attach(MIMEText(html,"html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.ehlo(); s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            recipients = [EMAIL_TO]+([EMAIL_CC] if EMAIL_CC else [])
            s.sendmail(SMTP_USER, recipients, msg.as_string())
        print(f"  ✓ Email sent → {EMAIL_TO}")
        return True
    except Exception as e:
        print(f"  ⚠ Email failed: {e}")
        return False


def gen_quiz(date_str, digest):
    """Generate 3 multiple choice quiz questions from today's digest articles."""
    print("\n🧠 Generating daily quiz...")
    articles = digest.get("articles", [])[:5]
    if not articles:
        print("  ℹ No articles to generate quiz from")
        return {"questions": []}

    summaries = "\n\n".join(
        f'Article {i+1}: "{a.get("title","")}" — {a.get("lead","")} ' +
        f'Key points: {"; ".join(a.get("key_points",[]))}' 
        for i, a in enumerate(articles)
    )

    system = """You are ArchBrief's quiz generator for an APS Solution Architect at IBM.
Generate exactly 3 multiple choice questions from the articles provided.
Mix: 1 recall, 1 comprehension, 1 application question.
Return ONLY valid JSON — no backticks:
{"questions":[{"q":"question text","options":["A. option","B. option","C. option","D. option"],"correct":0,"explanation":"Why correct — 2-3 sentences with architect context","vendors":["vendor_key"],"topicTag":"arch|security|ai|devops|industry"}]}
Correct index is 0-based. Wrong options must be plausible. Focus on architect understanding, not trivia."""

    raw  = call_claude(
        [{"role":"user","content":f"Generate 3 quiz questions from these APS architect articles:\n\n{summaries}"}],
        system
    )
    data = parse_json(raw)
    count = len(data.get("questions", []))
    print(f"  ✓ {count} quiz questions generated")
    return data

# ── MAIN ────────────────────────────────────────────
def main():
    print("="*58)
    print("  ArchBrief Daily Generator v2")
    print("="*58)

    now       = datetime.now(AEST)
    date_str  = now.strftime("%A %d %B %Y")
    date_key  = now.strftime("%Y-%m-%d")
    is_friday = now.weekday() == 4
    force     = os.environ.get("FORCE_REGENERATE","false").lower()=="true"

    print(f"\n📅 {date_str} AEST")
    print(f"🔑 API key:  {'✓' if ANTHROPIC_API_KEY else '✗ MISSING'}")
    print(f"📧 Email:    {'✓' if SMTP_HOST and EMAIL_TO else 'not configured'}")
    print(f"📅 Friday:   {'Yes — weekly email will run' if is_friday else 'No'}\n")

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set.")
        sys.exit(1)

    # Skip if already generated today
    if not force and Path(DATA_DIR / "daily.json").exists():
        try:
            with open(DATA_DIR / "daily.json") as f: ex = json.load(f)
            if ex.get("dateKey")==date_key:
                print("✓ Today's brief already exists — skipping.")
                sys.exit(0)
        except: pass

    # Load all context
    print("Loading personalisation context...")
    feedback = load_feedback()
    projects = load_projects()
    history  = load_history(days=7)
    context  = build_context(feedback, projects, history)

    errors = []

    # Generate
    try:
        digest = gen_digest(date_str, context)
    except Exception as e:
        print(f"❌ Digest: {e}"); errors.append(f"digest: {e}")
        digest = {"summary":"Generation failed.","articles":[],"apsAlert":None}

    # Generate quiz from digest
    quiz = {"questions": []}
    if digest.get("articles"):
        time.sleep(2)
        try:
            quiz = gen_quiz(date_str, digest)
        except Exception as e:
            print(f"❌ Quiz: {e}"); errors.append(f"quiz: {e}")

    time.sleep(3)

    try:
        aps = gen_aps(date_str)
    except Exception as e:
        print(f"❌ APS: {e}"); errors.append(f"aps: {e}")
        aps = {"lastUpdated":date_str,"keyAlerts":[],"irapStatus":[],"protectiveMarkings":[],"dtaAlignment":[],"sovereignty":[],"wogPlatforms":[]}

    # APS change detection
    aps_changes = detect_aps_changes(aps)
    if aps_changes:
        aps["_changes"] = aps_changes
        # Inject change alert into keyAlerts
        for c in aps_changes:
            if c.get("type")=="irap_change":
                aps["keyAlerts"].insert(0,
                    f"🔔 IRAP STATUS CHANGE: {c['vendor']} moved from {c['from']} → {c['to']}")

    time.sleep(3)

    try:
        explorer = gen_explorer(date_str, context)
    except Exception as e:
        print(f"❌ Explorer: {e}"); errors.append(f"explorer: {e}")
        explorer = {"articles":[]}

    # Update history
    if digest.get("articles"):
        update_history(date_key, date_str, digest["articles"])

    # Friday: weekly summary + email
    weekly_summary = None
    if is_friday:
        time.sleep(3)
        try:
            fresh_hist     = load_history(days=7)
            weekly_summary = gen_weekly(date_str, fresh_hist, feedback)
            email_html     = build_email_html(weekly_summary, date_str)
            with open(DATA_DIR / "weekly_summary.json","w") as f:
                json.dump({"dateKey":date_key,"date":date_str,
                           "summary":weekly_summary,"emailHtml":email_html},
                          f, indent=2, ensure_ascii=False)
            print("  ✓ weekly_summary.json saved")
            send_email(email_html, date_str)
        except Exception as e:
            print(f"❌ Weekly: {e}"); errors.append(f"weekly: {e}")

    # Write daily.json
    daily = {
        "dateKey":     date_key,
        "date":        date_str,
        "generatedAt": now.isoformat(),
        "generatedBy": "github-actions-v2",
        "vendors":     VENDOR_KEYS,
        "errors":      errors,
        "apsChanges":  aps_changes,
        "context": {
            "activeProjects": len(projects.get("active",[])),
            "feedbackUsed":   feedback.get("summary","none"),
            "historyDays":    history.get("recentCount",0),
        },
        "digest":   digest,
        "quiz":     quiz,
        "aps":      aps,
        "explorer": explorer,
    }

    with open(DATA_DIR / "daily.json","w",encoding="utf-8") as f:
        json.dump(daily, f, ensure_ascii=False, indent=2)

    size_kb = Path(DATA_DIR / "daily.json").stat().st_size/1024
    print(f"\n{'='*58}")
    print(f"  ✅ daily.json written ({size_kb:.1f} KB)")
    print(f"  {'⚠  '+str(len(errors))+' error(s)' if errors else '✓  All sections OK'}")
    if quiz.get('questions'): print(f"  ✓  {len(quiz['questions'])} quiz questions generated")
    if aps_changes: print(f"  🔔 {len(aps_changes)} APS change(s) detected")
    if is_friday and weekly_summary: print(f"  ✓  Weekly summary generated")
    print(f"{'='*58}\n")

if __name__=="__main__":
    main()
