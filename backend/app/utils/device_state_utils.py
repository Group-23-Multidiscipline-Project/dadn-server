from datetime import datetime, timezone
from math import ceil


def parse_datetime(value):
    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None

    return None


def to_iso(value):
    dt = parse_datetime(value)
    if not dt:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc).isoformat()


def calculate_remaining_seconds(state_doc, now):
    state = state_doc.get('state')
    if state == 'WATERING':
        end_at = parse_datetime(state_doc.get('wateringEndsAt'))
    elif state == 'RECOVER':
        end_at = parse_datetime(state_doc.get('recoverEndsAt'))
    else:
        end_at = None

    if not end_at:
        return 0

    if end_at.tzinfo is None:
        end_at = end_at.replace(tzinfo=timezone.utc)

    diff_seconds = (end_at - now).total_seconds()
    return max(0, ceil(diff_seconds))
