from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRES_MINUTES: int

    #admin
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

    # --- Password-reset OTP ---
    OTP_LENGTH: int = 6
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    # --- Outgoing email (SMTP) ---
    MAIL_HOST: str = "sandbox.smtp.mailtrap.io"
    MAIL_PORT: int = 2525
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "no-reply@papertrade.local"
    MAIL_FROM_NAME: str = "Paper Trading Platform"
    MAIL_STARTTLS: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()