from pydantic import BaseModel
from datetime import date
from typing import Optional
import uuid
from uuid import UUID

class LNHCScheduleCreate(BaseModel):
    date: date
    song_leader_id: Optional[uuid.UUID] = None 
    backup_1_id: Optional[uuid.UUID] = None 
    backup_2_id: Optional[uuid.UUID] = None
    lead_guitar_id: Optional[uuid.UUID] = None 
    acoustic_id: Optional[uuid.UUID] = None 
    bass_id: Optional[uuid.UUID] = None 
    keyboard_id: Optional[uuid.UUID] = None 
    drummer_id: Optional[uuid.UUID] = None 
    sound_tech_id: Optional[uuid.UUID] = None 
    easy_worship_id: Optional[uuid.UUID] = None 

class TangwayScheduleCreate(BaseModel):
    date: date

    song_leader_id: Optional[uuid.UUID] = None
    musician_id: Optional[uuid.UUID] = None
    multimedia_id: Optional[uuid.UUID] = None
    sound_tech_id: Optional[uuid.UUID] = None

class GarciaRosarioScheduleCreate(BaseModel):
    date: date

    singer_id: Optional[uuid.UUID] = None
    musicians_id: Optional[uuid.UUID] = None

class MemberResponse(BaseModel):
    id: UUID
    name: str
    is_active: bool