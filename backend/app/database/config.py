import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    #Later remove database_url
    DB_SERVICE_URL = os.getenv("DATABASE_URL", "database_url")

settings = Settings()
