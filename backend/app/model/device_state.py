from datetime import datetime
from typing import NotRequired, TypedDict

from pymongo import ASCENDING, DESCENDING
from pymongo.collection import Collection

from .chain_state import ChainState


DEVICE_STATE_COLLECTION_DEFAULT = 'device_states'


class DeviceStateDoc(TypedDict):
    deviceId: str
    state: ChainState
    stateStartedAt: datetime
    wateringEndsAt: NotRequired[datetime | None]
    recoverEndsAt: NotRequired[datetime | None]
    updatedAt: NotRequired[datetime]


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


def ensure_device_state_indexes(collection: Collection) -> None:
    if not _has_index(collection, [('deviceId', ASCENDING)], unique=True):
        collection.create_index(
            [('deviceId', ASCENDING)],
            unique=True,
            name='deviceId_unique_idx',
        )

    if not _has_index(collection, [('state', ASCENDING), ('updatedAt', DESCENDING)]):
        collection.create_index(
            [('state', ASCENDING), ('updatedAt', DESCENDING)],
            name='state_updatedAt_idx',
        )
