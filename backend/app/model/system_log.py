from datetime import datetime
from typing import NotRequired, TypedDict

from pymongo import ASCENDING, DESCENDING
from pymongo.collection import Collection


SYSTEM_LOG_COLLECTION_DEFAULT = 'system_logs'


class SystemLogDoc(TypedDict):
    eventId: str
    traceId: str
    eventType: str
    occurredAt: datetime
    deviceId: NotRequired[str | None]
    source: NotRequired[str | None]
    data: NotRequired[dict[str, object] | None]
    createdAt: NotRequired[datetime]


def _has_index(
    collection: Collection,
    keys: list[tuple[str, int]],
    *,
    unique: bool | None = None,
) -> bool:
    for index in collection.list_indexes():
        index_keys = list(index.get('key', {}).items())
        if index_keys != keys:
            continue

        if unique is None:
            return True

        return bool(index.get('unique', False)) == unique

    return False


def ensure_system_log_indexes(collection: Collection) -> None:
    if not _has_index(collection, [('eventId', ASCENDING)], unique=True):
        collection.create_index(
            [('eventId', ASCENDING)],
            unique=True,
            name='eventId_unique_idx',
        )

    if not _has_index(collection, [('traceId', ASCENDING)]):
        collection.create_index([('traceId', ASCENDING)], name='traceId_idx')

    if not _has_index(collection, [('eventType', ASCENDING)]):
        collection.create_index([('eventType', ASCENDING)], name='eventType_idx')

    if not _has_index(collection, [('traceId', ASCENDING), ('occurredAt', ASCENDING)]):
        collection.create_index(
            [('traceId', ASCENDING), ('occurredAt', ASCENDING)],
            name='traceId_occurredAt_idx',
        )

    if not _has_index(collection, [('eventType', ASCENDING), ('occurredAt', DESCENDING)]):
        collection.create_index(
            [('eventType', ASCENDING), ('occurredAt', DESCENDING)],
            name='eventType_occurredAt_idx',
        )
