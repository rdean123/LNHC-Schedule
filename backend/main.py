from fastapi import FastAPI, Depends
from sqlmodel import Session, select
from db import engine
from models import Member, SQLModel
from routes import router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# =====================
# CORS FIX
# =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://lnhc-pnw-sched.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_session():
    with Session(engine) as session:
        yield session

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

app.include_router(router)