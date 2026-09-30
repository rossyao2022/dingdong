"""Validate supplier shared mock reports and preserve immutable safe projections."""

import hashlib
import json
import logging
from math import isfinite

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from dingdong_ca.core.models import DingDongPushEvent, PrototypeReportSnapshot

from .ca_account import PROTOTYPE_ACCOUNT_ID

logger = logging.getLogger("dingdong_ca.push")
DIMENSIONS = (
    "linguistic",
    "logical",
    "musical",
    "spatial",
    "bodily",
    "intrapersonal",
    "interpersonal",
    "naturalistic",
)
WEEKLY_TURNS = (3, 7, 14, 21)
CURVE_DAYS = (0, 7, 15, 30, 60, 90, 180)
MILESTONE_EVENT = "dingdong.prototype.companion_milestone"


class InvalidPrototypeReport(Exception):
    pass


def number(value, maximum=None, *, integer=False):
    if type(value) not in (int, float):
        raise InvalidPrototypeReport("INVALID_NUMBER")
    try:
        finite = isfinite(value)
    except OverflowError:
        finite = False
    if not finite or value < 0 or (maximum is not None and value > maximum):
        raise InvalidPrototypeReport("INVALID_NUMBER")
    if integer and int(value) != value:
        raise InvalidPrototypeReport("INVALID_NUMBER")
    return int(value) if integer or int(value) == value else value


def text(value, *, nullable=False):
    if nullable and value is None:
        return None
    if not isinstance(value, str) or len(value) > 128:
        raise InvalidPrototypeReport("INVALID_TEXT")
    return value


def object_value(value):
    if not isinstance(value, dict):
        raise InvalidPrototypeReport("INVALID_STRUCTURE")
    return value


def scores(value):
    data = object_value(value)
    if set(data) != set(DIMENSIONS):
        raise InvalidPrototypeReport("INVALID_DIMENSIONS")
    return {key: number(data[key], 100) for key in DIMENSIONS}


def report_view(payload, requested_weekly=None):
    data = object_value(payload)
    if data.get("ca_account_id") != PROTOTYPE_ACCOUNT_ID or data.get("mode") != "prototype_mock":
        raise InvalidPrototypeReport("INVALID_SOURCE")
    assessment = object_value(data.get("assessment"))
    persona = object_value(data.get("persona") or {})
    companion = object_value(data.get("companion"))
    growth = object_value(data.get("growth"))
    current = object_value(growth.get("current"))
    if growth.get("source") != "simulation" or assessment.get("source") != "mock":
        raise InvalidPrototypeReport("INVALID_SOURCE")
    weekly = number(growth.get("weekly_turns"), integer=True)
    if weekly not in WEEKLY_TURNS or (requested_weekly is not None and weekly != requested_weekly):
        raise InvalidPrototypeReport("INVALID_WEEKLY_TURNS")
    try:
        updated = parse_datetime(companion.get("updated_at", ""))
    except (TypeError, ValueError):
        updated = None
    if updated is None or timezone.is_naive(updated):
        raise InvalidPrototypeReport("INVALID_UPDATED_AT")
    curve = growth.get("curve")
    if not isinstance(curve, list) or len(curve) != len(CURVE_DAYS):
        raise InvalidPrototypeReport("INVALID_CURVE")
    points = []
    for expected, raw in zip(CURVE_DAYS, curve, strict=True):
        point = object_value(raw)
        if type(point.get("day")) is not int or point["day"] != expected:
            raise InvalidPrototypeReport("INVALID_CURVE_ORDER")
        points.append(
            {
                "day": expected,
                "companion_value": number(point.get("companion_value")),
                "engagement_index": number(point.get("engagement_index"), 100),
                "growth_stage": text(point.get("growth_stage")),
                "dimensions": scores(point.get("dimensions")),
            }
        )
    match = persona.get("match_score")
    # The supplier historically serialized decimal scores; keep this scalar compatibility.
    if isinstance(match, str):
        try:
            match = float(match)
        except ValueError:
            raise InvalidPrototypeReport("INVALID_NUMBER") from None
    return {
        "availability": "ready",
        "assessment_type": text(assessment.get("talent_type"), nullable=True),
        "persona_name": text(persona.get("character_name"), nullable=True),
        "persona_type": text(persona.get("persona_type"), nullable=True),
        "match_score": None if match is None else number(match, 100),
        "companion_value": number(companion.get("value")),
        "effective_turns": number(companion.get("effective_turns"), integer=True),
        "assessment": {"baseline_scores": scores(assessment.get("baseline_scores"))},
        "growth": {
            "algorithm_version": text(growth.get("algorithm_version")),
            "current": {
                "engagement_index": number(current.get("engagement_index"), 100),
                "growth_stage": text(current.get("growth_stage")),
                "stage_progress": number(current.get("stage_progress"), 100),
                "dimensions": scores(current.get("dimensions")),
            },
            "weekly_turns": weekly,
            "curve": points,
            "source": "simulation",
        },
        "weekly_turns": weekly,
        "updated_at": updated.isoformat(),
    }


def save_snapshot(view, sync_source, event=None):
    digest = hashlib.sha256(
        json.dumps(view, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()
    fields = {
        "source_account_id": PROTOTYPE_ACCOUNT_ID,
        "weekly_turns": view["weekly_turns"],
        "source_updated_at": parse_datetime(view["updated_at"]),
        "sync_source": sync_source,
        "view": view,
        "content_hash": digest,
    }
    if sync_source == "pull":
        snapshot, _ = PrototypeReportSnapshot.objects.get_or_create(
            weekly_turns=view["weekly_turns"],
            content_hash=digest,
            sync_source="pull",
            defaults=fields,
        )
        return snapshot
    return PrototypeReportSnapshot.objects.create(event=event, **fields)


def latest_push(weekly):
    return (
        PrototypeReportSnapshot.objects.filter(
            source_account_id=PROTOTYPE_ACCOUNT_ID, weekly_turns=weekly, sync_source="push"
        )
        .order_by("-source_updated_at", "-created_at", "-id")
        .first()
    )


def push_log(event_id, state, error=""):
    fingerprint = hashlib.sha256(event_id.encode()).hexdigest()[:12]
    logger.info("push state=%s code=%s event_hash=%s", state, error or "OK", fingerprint)


def event_log(event, state, error=""):
    push_log(event.event_id, state, error)


def process_event(event_id):
    with transaction.atomic():
        event = DingDongPushEvent.objects.select_for_update().get(pk=event_id)
        if event.processing_status != "received":
            return event
        if event.event_type != MILESTONE_EVENT:
            event.processing_status, event.processing_error = "ignored", "UNSUPPORTED_EVENT"
        else:
            try:
                view = report_view(event.payload.get("data"))
                milestone = object_value(event.payload.get("milestone"))
                completed = number(milestone.get("completed_turns"), integer=True)
                if (
                    type(milestone.get("interval")) is not int
                    or milestone["interval"] != 3
                    or completed < 3
                    or completed % 3
                    or completed != view["effective_turns"]
                ):
                    raise InvalidPrototypeReport("INVALID_MILESTONE")
                save_snapshot(view, "push", event)
                event.processing_status, event.processing_error = "processed", ""
            except InvalidPrototypeReport as exc:
                event.processing_status, event.processing_error = "invalid", str(exc)
        event.save(update_fields=["processing_status", "processing_error", "updated_at"])
        event_log(event, event.processing_status, event.processing_error)
        return event
