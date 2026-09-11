import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# PostgreSQL Database URL
DATABASE_URL = "postgresql+psycopg://postgres:1234@localhost:5432/infosys_internship"


# Create database engine
engine = create_engine(
    DATABASE_URL,
)


# Create database session
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# SQLAlchemy Base
class Base(DeclarativeBase):
    pass


# Database dependency
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()