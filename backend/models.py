from sqlmodel import Column, DateTime, Index, SQLModel, Field
from typing import Optional
from datetime import date, datetime
import uuid


class Member(SQLModel, table=True):
    __tablename__ = "members"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    role: Optional[str] = None
    is_active: bool = True


class LNHCSchedule(SQLModel, table=True):
    __tablename__ = "lnhc_schedules"

    __table_args__ = (
        Index("idx_lnhc_date", "date"),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    date: date

    song_leader_id: Optional[uuid.UUID] = None
    backup_1_id: Optional[uuid.UUID] = Field(default=None, foreign_key="members.id")
    backup_2_id: Optional[uuid.UUID] = Field(default=None, foreign_key="members.id")
    lead_guitar_id: Optional[uuid.UUID] = None
    acoustic_id: Optional[uuid.UUID] = None
    bass_id: Optional[uuid.UUID] = None
    keyboard_id: Optional[uuid.UUID] = None
    drummer_id: Optional[uuid.UUID] = None
    sound_tech_id: Optional[uuid.UUID] = None
    easy_worship_id: Optional[uuid.UUID] = None
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow)
    )
    
class TangwaySchedule(SQLModel, table=True):
    __tablename__ = "tangway_schedules"

    __table_args__ = (
        Index("idx_tangway_date", "date"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    date: date

    song_leader_id: Optional[uuid.UUID] = None
    musician_id: Optional[uuid.UUID] = None
    multimedia_id: Optional[uuid.UUID] = None
    sound_tech_id: Optional[uuid.UUID] = None
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow)
    )
    
class GarciaRosarioSchedule(SQLModel, table=True):
    __tablename__ = "garcia_rosario_schedules"

    __table_args__ = (
        Index("idx_garcia_rosario_date", "date"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    date: date

    singer_id: Optional[uuid.UUID] = None
    musicians_id: Optional[uuid.UUID] = None
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow)
    )