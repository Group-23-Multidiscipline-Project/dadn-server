from datetime import datetime
from typing import NotRequired, TypedDict

from pymongo import ASCENDING, DESCENDING
from pymongo.collection import Collection

from .chain_state import ChainState


EVENT_LOG_COLLECTION_DEFAULT = 'event_logs'


class EventLogDoc(TypedDict):
    deviceId: str
    state: ChainState
    action: str
    timestamp: datetime
    topic: NotRequired[str | None]
    moisture: NotRequired[float | None]
    light: NotRequired[float | None]
    metadata: NotRequired[dict[str, object] | None]
    createdAt: NotRequired[datetime]


def _has_index(collection: Collection, keys: list[tuple[str, int]]) -> bool:
    for index in collection.list_indexes():
        index_keys = list(index.get('key', {}).items())
        if index_keys == keys:
            return True

    return False


def ensure_event_log_indexes(collection: Collection) -> None:
    if not _has_index(collection, [('deviceId', ASCENDING), ('timestamp', DESCENDING)]):
        collection.create_index(
            [('deviceId', ASCENDING), ('timestamp', DESCENDING)],
            name='deviceId_timestamp_idx',
        )

    if not _has_index(collection, [('topic', ASCENDING), ('timestamp', DESCENDING)]):
        collection.create_index(
            [('topic', ASCENDING), ('timestamp', DESCENDING)],
            name='topic_timestamp_idx',
        )

    if not _has_index(collection, [('state', ASCENDING), ('timestamp', DESCENDING)]):
        collection.create_index(
            [('state', ASCENDING), ('timestamp', DESCENDING)],
            name='state_timestamp_idx',
        )
