from enum import Enum


class ChainState(str, Enum):
    MONITOR = 'MONITOR'
    WATERING = 'WATERING'
    RECOVER = 'RECOVER'
