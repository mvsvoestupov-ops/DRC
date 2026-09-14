"""
Инвентаризация тегов XML профстандарта Минтруда vs макет I–V.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\inventory_ps_xml_tags.py
  venv\\Scripts\\python.exe scripts\\inventory_ps_xml_tags.py 77849 147682 125540
"""
from __future__ import annotations

import json
import os
import sys
import warnings
from collections import Counter

from lxml import etree

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.parser import download_bulk_xml_chunk

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
DOWNLOADS = os.path.join(BACKEND_DIR, "downloads")
REPORT_JSON = os.path.join(OUTPUT_DIR, "ps_xml_tag_inventory.json")
REPORT_TXT = os.path.join(OUTPUT_DIR, "ps_xml_tag_inventory.txt")

DEFAULT_IDS = ["77849", "147682", "125540"]  # известные ELEMENT_ID из sync-лога

# Ожидаемые блоки макета → типичные XML-теги (гипотезы + факт после прогона)
MAKET_EXPECTATIONS = {
    "I_general": [
        "KindProfessionalActivity",
        "CodeKindProfessionalActivity",
        "PurposeKindProfessionalActivity",
        "CodeOKVED",
        "NameOKVED",
    ],
    "III_otf_requirements": [
        "RequirementsToEducationAndTraining",
        "RequirementsToExperienceOfPracticalWork",
        "ParticularConditionsForAdmission",
        "AdditionalCharacteristics",
        "EducationalRequirements",
        "ExperienceRequirements",
    ],
    "III_classifiers": [
        "CodeOKZ",
        "NameOKZ",
        "CodeOKPDTR",
        "NameOKPDTR",
        "CodeOKSO",
        "NameOKSO",
        "CodeETKS",
        "NameETKS",
        "CodeEKS",
        "NameEKS",
    ],
    "III_tf_skills": [
        "RequiredSkill",
        "NecessaryKnowledge",
        "LaborAction",
        "OtherCharacteristics",
    ],
    "IV_developers": [
        "ResponsibleOrganization",
        "NameOfOrganization",
        "NameResponsibleOrganization",
        "DeveloperOrganization",
        "FourthSection",
    ],
    "V_abbreviations": [
        "ListOfAbbreviations",
        "Abbreviation",
        "FifthSection",
    ],
}


def collect_tags(root) -> Counter:
    counts: Counter = Counter()
    for el in root.iter():
        tag = el.tag
        if isinstance(tag, str) and "}" in tag:
            tag = tag.rsplit("}", 1)[-1]
        counts[tag] += 1
    return counts


def main() -> int:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")
    ids = sys.argv[1:] or DEFAULT_IDS
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DOWNLOADS, exist_ok=True)

    all_tags: Counter = Counter()
    per_file: dict[str, dict] = {}

    for eid in ids:
        path = os.path.join(DOWNLOADS, f"inventory_{eid}.xml")
        try:
            download_bulk_xml_chunk([eid], path)
        except Exception as exc:
            print(f"ELEMENT_ID={eid}: ошибка загрузки — {exc}")
            per_file[eid] = {"error": str(exc)}
            continue

        try:
            content = open(path, "rb").read()
            for enc in ("utf-8", "windows-1251", "cp1251"):
                try:
                    text = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                text = content.decode("utf-8", errors="ignore")
            import html as html_mod

            text = html_mod.unescape(text)
            root = etree.fromstring(text.encode("utf-8"))
        except Exception as exc:
            print(f"ELEMENT_ID={eid}: ошибка парсинга — {exc}")
            per_file[eid] = {"error": f"parse: {exc}", "bytes": os.path.getsize(path)}
            continue

        tags = collect_tags(root)
        all_tags.update(tags)
        per_file[eid] = {
            "path": path,
            "bytes": os.path.getsize(path),
            "unique_tags": sorted(tags.keys()),
            "tag_counts": dict(tags.most_common()),
        }
        print(f"ELEMENT_ID={eid}: {len(tags)} уникальных тегов, {sum(tags.values())} узлов")

    coverage = {}
    for group, expected in MAKET_EXPECTATIONS.items():
        present = [t for t in expected if t in all_tags]
        missing = [t for t in expected if t not in all_tags]
        coverage[group] = {"present": present, "missing": missing}

    report = {
        "element_ids": ids,
        "union_unique_tags": sorted(all_tags.keys()),
        "union_tag_counts": dict(all_tags.most_common()),
        "maket_coverage": coverage,
        "per_file": per_file,
    }
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        "ИНВЕНТАРИЗАЦИЯ XML ПС (Минтруд)",
        "=" * 60,
        f"ID: {', '.join(ids)}",
        f"Уникальных тегов (объединение): {len(all_tags)}",
        "",
        "Покрытие гипотез макета:",
    ]
    for group, info in coverage.items():
        lines.append(f"  [{group}]")
        lines.append(f"    есть: {', '.join(info['present']) or '—'}")
        lines.append(f"    нет:  {', '.join(info['missing']) or '—'}")
    lines += ["", "Все теги:"]
    for tag, cnt in all_tags.most_common():
        lines.append(f"  {cnt:5d}  {tag}")

    with open(REPORT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("\n".join(lines[:40]))
    print(f"\nJSON: {REPORT_JSON}")
    print(f"TXT:  {REPORT_TXT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
