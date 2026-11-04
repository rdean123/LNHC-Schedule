from sqlmodel import Session, or_, select
from datetime import date
import uuid
from typing import Optional, Union
from models import (
    LNHCSchedule,
    TangwaySchedule,
    GarciaRosarioSchedule,
)


class SchedulingService:

    @staticmethod
    def is_member_available(
        session: Session, 
        member_id: uuid.UUID, 
        date: date, 
        ignore_schedule_id: Optional[Union[str, int, uuid.UUID]] = None
    ) -> bool:
        """
        Returns True if member is NOT scheduled anywhere on that date.
        Returns False if conflict exists.
        """
        return not SchedulingService._has_conflict(session, member_id, date, ignore_schedule_id)

    @staticmethod
    def validate_members(
        session: Session, 
        member_ids: list, 
        date: date, 
        ignore_schedule_id: Optional[Union[str, int, uuid.UUID]] = None
    ) -> bool:
        for member_id in member_ids:
            if member_id:
                # Pass ignore_schedule_id down into the availability check
                if not SchedulingService.is_member_available(session, member_id, date, ignore_schedule_id):
                    return False
        return True

    @staticmethod
    def _has_conflict(
        session: Session, 
        member_id: str, 
        date: date, 
        ignore_schedule_id: Optional[Union[str, int, uuid.UUID]] = None
    ) -> bool:
        
        # Convert ignore_schedule_id to string if it exists to safely match DB values
        target_ignore_id = str(ignore_schedule_id) if ignore_schedule_id is not None else None

        # ---------- LNHC ----------
        lnhc_stmt = select(LNHCSchedule).where(
            LNHCSchedule.date == date,
            or_(
                LNHCSchedule.song_leader_id == member_id,
                LNHCSchedule.backup_1_id == member_id, 
                LNHCSchedule.backup_2_id == member_id,
                LNHCSchedule.lead_guitar_id == member_id,
                LNHCSchedule.acoustic_id == member_id,
                LNHCSchedule.bass_id == member_id,
                LNHCSchedule.keyboard_id == member_id,
                LNHCSchedule.drummer_id == member_id,
                LNHCSchedule.sound_tech_id == member_id,
                LNHCSchedule.easy_worship_id == member_id,
            )
        )
        #  Skip checking this row if we are updating an existing LNHC row
        if target_ignore_id:
            lnhc_stmt = lnhc_stmt.where(LNHCSchedule.id != target_ignore_id)

        lnhc_conflict = session.exec(lnhc_stmt).first()
        if lnhc_conflict:
            return True

        # ---------- TANGWAY ----------
        tangway_stmt = select(TangwaySchedule).where(
            TangwaySchedule.date == date,
            or_(
                TangwaySchedule.song_leader_id == member_id,
                TangwaySchedule.musician_id == member_id,
                TangwaySchedule.multimedia_id == member_id,
                TangwaySchedule.sound_tech_id == member_id,
            )
        )
        # Skip checking this row if we are updating an existing Tangway row
        if target_ignore_id:
            tangway_stmt = tangway_stmt.where(TangwaySchedule.id != target_ignore_id)

        tangway_conflict = session.exec(tangway_stmt).first()
        if tangway_conflict:
            return True

        # ---------- GARCIA / ROSARIO ----------
        gr_stmt = select(GarciaRosarioSchedule).where(
            GarciaRosarioSchedule.date == date,
            or_(
                GarciaRosarioSchedule.singer_id == member_id,
                GarciaRosarioSchedule.musicians_id == member_id,
            )
        )
        # Skip checking this row if we are updating an existing Garcia/Rosario row
        if target_ignore_id:
            gr_stmt = gr_stmt.where(GarciaRosarioSchedule.id != target_ignore_id)

        gr_conflict = session.exec(gr_stmt).first()
        if gr_conflict:
            return True

        return False

    @staticmethod
    def save(session: Session, obj):
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj