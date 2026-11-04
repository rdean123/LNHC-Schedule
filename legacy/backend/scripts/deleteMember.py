import uuid
import sys
import os
from sqlmodel import Session

# Add project root (lnhc-pnw-scheduling-backend) to Python path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from db import engine  # now this will work
from models import Member

def delete_member(member_id: str):
    with Session(engine) as session:
        member = session.get(Member, uuid.UUID(member_id))

        if not member:
            print("Member not found")
            return

        session.delete(member)  # or soft delete if you prefer
        session.commit()

        print(f"Deleted member: {member.name}")

if __name__ == "__main__":
    member_id = input("Enter member UUID: ")
    delete_member(member_id)