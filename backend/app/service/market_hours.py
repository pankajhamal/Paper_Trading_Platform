"""NEPSE trading calendar.

Used to answer "is the market open right now?" from the clock alone, for when
the bridge's live `marketStatus` isn't available. Holidays are not modelled —
this is the weekly schedule only, so a public holiday reads as open.
"""
from datetime import datetime, time, timedelta, timezone

# Nepal Standard Time is UTC+05:45.
NPT = timezone(timedelta(hours=5, minutes=45))

# NEPSE trades Sunday–Thursday. Python's weekday(): Mon=0 … Sun=6.
TRADING_DAYS = {6, 0, 1, 2, 3}
OPEN_TIME = time(11, 0)
CLOSE_TIME = time(15, 0)


def now_npt() -> datetime:
    return datetime.now(NPT)


def is_market_open_now(moment: datetime | None = None) -> bool:
    """True if NEPSE is inside its Sun–Thu 11:00–15:00 NPT trading window."""
    moment = (moment or now_npt()).astimezone(NPT)
    if moment.weekday() not in TRADING_DAYS:
        return False
    return OPEN_TIME <= moment.time() <= CLOSE_TIME
