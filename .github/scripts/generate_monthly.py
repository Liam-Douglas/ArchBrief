#!/usr/bin/env python3
"""
ArchBrief v5 — generate_monthly.py
Monthly living path content regeneration.

Reads the module list, checks which modules need refreshing
(not mastered by user, older than 30 days), generates fresh
content via Claude + web search, writes to path_content.json.

Runs 1st of every month via GitHub Actions.
"""

import os
import json
import time
import anthropic
from datetime import datetime, timezone
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────
client       = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL        = "claude-opus-4-6"
ROOT         = Path(__file__).parent.parent.parent
DATA_DIR     = ROOT / "data"
PATH_FILE    = DATA_DIR / "path_content.json"

# ── MODULE DEFINITIONS ──────────────────────────────────
# Mirror of path.js LP_DOMAINS — source of truth for what to generate
MODULES = [
    # Cloud Foundations
    {"id":"cf-01","name":"Cloud Service Models","vendors":["aws","azure","ibm","oracle"],"desc":"IaaS, PaaS, SaaS — when to use what for APS workloads"},
    {"id":"cf-02","name":"AWS Core Services","vendors":["aws"],"desc":"EC2, S3, VPC, IAM, RDS — current features and APS considerations"},
    {"id":"cf-03","name":"Azure for Government","vendors":["azure"],"desc":"Azure regions, PROTECTED workloads, current APS certifications"},
    {"id":"cf-04","name":"IBM Cloud & Hybrid","vendors":["ibm"],"desc":"IBM Cloud, OpenShift, hybrid patterns for APS"},
    {"id":"cf-05","name":"Oracle Cloud for APS","vendors":["oracle"],"desc":"OCI, sovereign cloud options for Australian government"},
    {"id":"cf-06","name":"Multi-Cloud Architecture","vendors":["aws","azure","ibm","oracle"],"desc":"Patterns, governance, anti-patterns — current best practice"},
    {"id":"cf-07","name":"Cloud Networking","vendors":["aws","azure","ibm"],"desc":"VPCs, peering, transit gateways — current options"},
    {"id":"cf-08","name":"FinOps & Cloud Economics","vendors":["aws","azure","ibm","oracle"],"desc":"Current pricing models, reserved instances, WoG agreements"},
    {"id":"cf-09","name":"Landing Zones","vendors":["aws","azure"],"desc":"Control Tower, Azure Landing Zone, ISM controls — current versions"},
    # AI & Data
    {"id":"ai-01","name":"IBM watsonx","vendors":["ibm"],"desc":"Current watsonx.ai, .data, .governance capabilities"},
    {"id":"ai-02","name":"Azure OpenAI & Copilot","vendors":["azure"],"desc":"Current GPT-4o, Copilot for Government, APS AI policy"},
    {"id":"ai-03","name":"AWS AI/ML Services","vendors":["aws"],"desc":"Current SageMaker, Bedrock, Nova models"},
    {"id":"ai-04","name":"Emerging AI Tools","vendors":["emerging"],"desc":"Current LLM landscape, agentic AI for APS"},
    # Security
    {"id":"sec-01","name":"Zero Trust Principles","vendors":["paloalto","azure","aws"],"desc":"Current zero trust frameworks, ISM alignment"},
    {"id":"sec-02","name":"Palo Alto SASE & Prisma","vendors":["paloalto"],"desc":"Current Prisma Cloud, Prisma SASE, Cortex XDR features"},
    {"id":"sec-03","name":"Cloud Security Posture","vendors":["paloalto","aws","azure"],"desc":"Current CSPM, CIEM tools and ISM mapping"},
    {"id":"sec-04","name":"Identity & IAM","vendors":["azure","aws","ibm"],"desc":"Current Entra ID, AWS IAM Identity Center, federation patterns"},
    # Platform & DevOps
    {"id":"plat-01","name":"HashiCorp Terraform","vendors":["hashicorp"],"desc":"Current Terraform, OpenTofu, HCP Terraform features"},
    {"id":"plat-02","name":"Kubernetes & OpenShift","vendors":["ibm","aws","azure"],"desc":"Current Kubernetes versions, OpenShift 4.x, AKS, EKS"},
    {"id":"plat-03","name":"CI/CD & DevSecOps","vendors":["hashicorp","aws","azure"],"desc":"Current GitOps, security gates, APS pipeline patterns"},
    # Enterprise SaaS
    {"id":"saas-01","name":"Salesforce for Government","vendors":["salesforce"],"desc":"Current Gov Cloud, Shield, data residency options"},
    {"id":"saas-02","name":"ServiceNow in APS","vendors":["servicenow"],"desc":"Current ITSM, GRC, APS implementations"},
    # APS & Government
    {"id":"aps-01","name":"ISM & IRAP Fundamentals","vendors":["aws","azure","ibm"],"desc":"Current ISM version, IRAP process, assessed vendors"},
    {"id":"aps-02","name":"Protective Markings","vendors":["aws","azure","ibm"],"desc":"Current OFFICIAL/PROTECTED technical requirements"},
    {"id":"aps-03","name":"DTA Cloud Policy","vendors":["aws","azure","ibm","oracle"],"desc":"Current DTA guidance and cloud procurement rules"},
    {"id":"aps-04","name":"Data Sovereignty","vendors":["aws","azure","ibm","oracle"],"desc":"Current sovereignty options and requirements"},
    {"id":"aps-05","name":"WoG Platforms","vendors":["aws","azure","ibm"],"desc":"Current myGov, Digital ID, ATO integration patterns"},
    {"id":"aps-06","name":"Vendor Evaluation for APS","vendors":["aws","azure","ibm","oracle","salesforce","servicenow"],"desc":"Current APS procurement frameworks and evaluation methods"},
]

# ── LOAD EXISTING CONTENT ────────────────────────────────
def load_existing():
    if PATH_FILE.exists():
        try:
            with open(PATH_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {"modules": {}, "generatedAt": None, "version": 5}

# ── NEEDS REFRESH? ───────────────────────────────────────
def needs_refresh(mod_id, existing):
    """Return True if module content is missing or older than 30 days."""
    mod = existing.get("modules", {}).get(mod_id)
    if not mod or not mod.get("content"):
        return True
    try:
        updated = datetime.fromisoformat(mod["updatedAt"].replace("Z", "+00:00"))
        age_days = (datetime.now(timezone.utc) - updated).days
        return age_days >= 30
    except Exception:
        return True

# ── GENERATE MODULE CONTENT ──────────────────────────────
def generate_module(module):
    """Generate rich module content via Claude + web search."""
    vendors = ", ".join(module.get("vendors", []))
    prompt = f"""Generate fresh, current learning content for an ArchBrief module.

Module: {module['name']}
Description: {module['desc']}
Primary vendors: {vendors}
Audience: Assistant Solution Architect, IBM, Australian Public Sector

Search the web for the LATEST information — current product versions, recent announcements, pricing changes.

Return ONLY valid JSON:
{{
  "content": "6-8 paragraphs of rich markdown content. Cover: what it is, current state (versions/features as of today), how it applies to APS, architecture patterns, trade-offs, ISM/IRAP implications where relevant. Use real current facts.",
  "keyFacts": ["current fact 1", "current fact 2", "current fact 3", "current fact 4"],
  "apsConsiderations": ["APS point 1", "APS point 2"],
  "currentAsOf": "month year"
}}"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}],
    )

    # Extract text blocks
    text = " ".join(b.text for b in response.content if hasattr(b, "text") and b.text)

    # Strip markdown fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # raw_decode stops at the end of the first valid JSON value,
    # ignoring any trailing prose Claude appends after the JSON.
    start = text.find('{')
    if start == -1: start = text.find('[')
    if start != -1:
        text = text[start:]
    obj, _ = json.JSONDecoder().raw_decode(text)
    return obj

# ── MAIN ─────────────────────────────────────────────────
def main():
    print(f"ArchBrief v5 — Monthly Path Update — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Checking {len(MODULES)} modules...")

    existing = load_existing()
    updated  = 0
    skipped  = 0

    for i, module in enumerate(MODULES):
        mod_id = module["id"]

        if not needs_refresh(mod_id, existing):
            print(f"  [{i+1:02d}/{len(MODULES)}] SKIP {mod_id} — content fresh")
            skipped += 1
            continue

        print(f"  [{i+1:02d}/{len(MODULES)}] GENERATING {mod_id} — {module['name']}...")
        try:
            data = generate_module(module)
            if not existing.get("modules"):
                existing["modules"] = {}
            existing["modules"][mod_id] = {
                **data,
                "moduleId":  mod_id,
                "moduleName": module["name"],
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "vendors":   module.get("vendors", []),
            }
            updated += 1
            print(f"           ✓ {len(data.get('content','').split())} words, {len(data.get('keyFacts',[]))} facts")
        except Exception as e:
            print(f"           ✗ FAILED: {e}")

        # Brief pause between API calls to avoid rate limiting
        time.sleep(5)

    # Write output
    existing["generatedAt"] = datetime.now(timezone.utc).isoformat()
    existing["version"]     = 5
    existing["stats"]       = {
        "totalModules": len(MODULES),
        "updated":      updated,
        "skipped":      skipped,
    }

    DATA_DIR.mkdir(exist_ok=True)
    with open(PATH_FILE, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"\n✓ Done — {updated} updated, {skipped} skipped")
    print(f"  Written to {PATH_FILE}")

if __name__ == "__main__":
    main()
