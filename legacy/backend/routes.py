from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select
from models import GarciaRosarioSchedule, LNHCSchedule, Member, TangwaySchedule
from db import engine
from schemas.schemas import GarciaRosarioScheduleCreate, MemberResponse, TangwayScheduleCreate, LNHCScheduleCreate
from services.scheduling_service import SchedulingService
from datetime import date
import uuid

router = APIRouter()


def get_session():
    with Session(engine) as session:
        yield session

# =====================
# Creating Members on DB for the PnW Members
# =====================

@router.post("/members", response_model=MemberResponse)
def create_member(
    payload: dict = Body(...),
    session: Session = Depends(get_session)
):
    name = payload.get("name")

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    member = Member(
        name=name,
        is_active=True
    )

    session.add(member)
    session.commit()
    session.refresh(member)

    return member

# =====================
# Deleting members endpoint
# =====================
@router.delete("/members/{member_id}")
def delete_member(
    member_id: uuid.UUID,
    session: Session = Depends(get_session)
):
    member = session.get(Member, member_id)

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.is_active = False
    session.add(member)
    session.commit()

    return {"message": "deleted"}

# =====================
# Getting Members on DB for the PnW Members
# =====================

@router.get("/members", response_model=List[MemberResponse])
def get_members(session: Session = Depends(get_session)):
    statement = select(Member).where(Member.is_active == True)
    results = session.exec(statement).all()
    return results


# =====================
# Getting Availability of the PnW For Conflict (Not sure if needed)
# =====================

@router.get("/availability")
def check_availability(
    member_id: uuid.UUID,
    date: date,
    session: Session = Depends(get_session),
):
    available = SchedulingService.is_member_available(
        session,
        member_id,
        date
    )

    return {
        "member_id": member_id,
        "date": date,
        "available": available
    }

# =====================
# Adding Schedule LNCH
# =====================
@router.post("/lnhc")
def create_lnhc_schedule(
    payload: LNHCScheduleCreate,
    session: Session = Depends(get_session)
):
    member_ids = [
        payload.song_leader_id,
        payload.backup_1_id, 
        payload.backup_2_id,
        payload.lead_guitar_id,
        payload.acoustic_id,
        payload.bass_id,
        payload.keyboard_id,
        payload.drummer_id,
        payload.sound_tech_id,
        payload.easy_worship_id,
    ]
    # FIX HERE: Filter out None values for unassigned slots
    member_ids = [m_id for m_id in member_ids if m_id is not None]

    if not SchedulingService.validate_members(session, member_ids, payload.date):
        raise HTTPException(
            status_code=400,
            detail="Member already scheduled on this date"
        )

    schedule = LNHCSchedule(**payload.model_dump())
    return SchedulingService.save(session, schedule)


# =====================
# Adding Schedule Tangway
# =====================
@router.post("/tangway")
def create_tangway_schedule(
    payload: TangwayScheduleCreate,
    session: Session = Depends(get_session)
):
    member_ids = [
        payload.song_leader_id,
        payload.musician_id,
        payload.multimedia_id,
        payload.sound_tech_id,
    ]
    # FIX HERE: Filter out None values
    member_ids = [m_id for m_id in member_ids if m_id is not None]

    if not SchedulingService.validate_members(session, member_ids, payload.date):
        raise HTTPException(
            status_code=400,
            detail="Member already scheduled on this date"
        )

    schedule = TangwaySchedule(**payload.model_dump())
    return SchedulingService.save(session, schedule)


# =====================
# Adding Schedule Garcia/Rosario
# =====================
@router.post("/garcia-rosario")
def create_gr_schedule(
    payload: GarciaRosarioScheduleCreate,
    session: Session = Depends(get_session)
):
    member_ids = [
        payload.singer_id,
        payload.musicians_id,
    ]
    # FIX HERE: Filter out None values
    member_ids = [m_id for m_id in member_ids if m_id is not None]

    if not SchedulingService.validate_members(session, member_ids, payload.date):
        raise HTTPException(
            status_code=400,
            detail="Member already scheduled on this date"
        )

    schedule = GarciaRosarioSchedule(**payload.model_dump())
    return SchedulingService.save(session, schedule)

# ================
# GET ENDPOINTS FOR CHURCHES
# ================
@router.get("/lnhc")
def get_lnhc_schedules(session: Session = Depends(get_session)):
    statement = select(LNHCSchedule)
    return session.exec(statement).all()

@router.get("/tangway")
def get_tangway_schedules(session: Session = Depends(get_session)):
    statement = select(TangwaySchedule)
    return session.exec(statement).all()

@router.get("/garcia-rosario")
def get_gr_schedules(session: Session = Depends(get_session)):
    statement = select(GarciaRosarioSchedule)
    return session.exec(statement).all()

# =====================
# Updating Schedule LNCH
# =====================
@router.put("/lnhc/{schedule_id}")
def update_lnhc_schedule(
    schedule_id: str, # 👈 CHANGED from int to str
    payload: LNHCScheduleCreate,
    session: Session = Depends(get_session)
):
    schedule = session.get(LNHCSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Gather assigned member IDs for conflict validations
    member_ids = [
        payload.song_leader_id, payload.backup_1_id,  
        payload.backup_2_id, payload.lead_guitar_id,
        payload.acoustic_id, payload.bass_id, payload.keyboard_id,
        payload.drummer_id, payload.sound_tech_id, payload.easy_worship_id,
    ]
    # Filter out None/empty values so we only check actual personnel
    member_ids = [m_id for m_id in member_ids if m_id is not None]

    # Validate conflicts (ignoring checks if they are already on this row)
    if not SchedulingService.validate_members(session, member_ids, payload.date, ignore_schedule_id=schedule_id):
        raise HTTPException(status_code=400, detail="Roster member conflict detected on this date")

    # Update database fields dynamically
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(schedule, key, value)

    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


# =====================
# Updating Schedule Tangway
# =====================
@router.put("/tangway/{schedule_id}")
def update_tangway_schedule(
    schedule_id: str,
    payload: TangwayScheduleCreate,
    session: Session = Depends(get_session)
):
    schedule = session.get(TangwaySchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    member_ids = [payload.song_leader_id, payload.musician_id, payload.multimedia_id, payload.sound_tech_id]
    member_ids = [m_id for m_id in member_ids if m_id is not None]

    if not SchedulingService.validate_members(session, member_ids, payload.date, ignore_schedule_id=schedule_id):
        raise HTTPException(status_code=400, detail="Roster member conflict detected on this date")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(schedule, key, value)

    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


# =====================
# Updating Schedule Garcia/Rosario
# =====================
@router.put("/garcia-rosario/{schedule_id}")
def update_gr_schedule(
    schedule_id: str,
    payload: GarciaRosarioScheduleCreate,
    session: Session = Depends(get_session)
):
    schedule = session.get(GarciaRosarioSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    member_ids = [payload.singer_id, payload.musicians_id]
    member_ids = [m_id for m_id in member_ids if m_id is not None]

    if not SchedulingService.validate_members(session, member_ids, payload.date, ignore_schedule_id=schedule_id):
        raise HTTPException(status_code=400, detail="Roster member conflict detected on this date")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(schedule, key, value)

    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule

# =====================
# Deleting Schedule LNHC
# =====================
@router.delete("/lnhc/{schedule_id}")
def delete_lnhc_schedule(
    schedule_id: str,
    session: Session = Depends(get_session)
):
    schedule = session.get(LNHCSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="LNHC Schedule record not found")
    
    session.delete(schedule)
    session.commit()
    return {"message": "Schedule deleted successfully"}


# =====================
# Deleting Schedule Tangway
# =====================
@router.delete("/tangway/{schedule_id}")
def delete_tangway_schedule(
    schedule_id: str,
    session: Session = Depends(get_session)
):
    schedule = session.get(TangwaySchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Tangway Schedule record not found")
    
    session.delete(schedule)
    session.commit()
    return {"message": "Schedule deleted successfully"}


# =====================
# Deleting Schedule Garcia/Rosario
# =====================
@router.delete("/garcia-rosario/{schedule_id}")
def delete_gr_schedule(
    schedule_id: str,
    session: Session = Depends(get_session)
):
    schedule = session.get(GarciaRosarioSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Garcia/Rosario Schedule record not found")
    
    session.delete(schedule)
    session.commit()
    return {"message": "Schedule deleted successfully"}