from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRES_MINUTES: int

    # --- Default admin (seeded on startup if missing) ---
    # No password default is shipped in code — it MUST come from the environment
    # so a fresh deploy can never boot with a known, guessable admin password.
    DEFAULT_ADMIN_EMAIL: str = "admin@gmail.com"
    DEFAULT_ADMIN_PASSWORD: str
    DEFAULT_ADMIN_NAME: str = "Administrator"

    # --- Order lifecycle tuning (safe defaults; override in .env if desired) ---
    # How long a pending limit order stays alive before it expires and its
    # escrow (cash for buys / shares for sells) is returned to the user.
    # NEPSE orders are day-orders; 360 min (~6h) approximates a trading day.
    # Lower this (e.g. 2) when demoing the expiry flow.
    ORDER_EXPIRY_MINUTES: int = 360
    # How often the matching engine scans for fillable pending orders.
    MATCHER_INTERVAL_SECONDS: int = 10
    # How often the expiry scanner runs.
    EXPIRY_SCAN_INTERVAL_SECONDS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()