from sqlalchemy import Column, Integer, String, Float
from database.base import Base

class User(Base):
    __tablename__="users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    password = Column(String)
    balance = Column(Float, default=100000)