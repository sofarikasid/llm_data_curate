from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class Message(BaseModel):
    role: str
    content: str

class ChatFormat(BaseModel):
    messages: List[Message]

class InstructionFormat(BaseModel):
    instruction: str
    input: Optional[str] = None
    output: str

class DataEntry(BaseModel):
    id: str
    type: str  # 'chat' or 'instruction'
    data: Dict[str, Any]  # Will contain either ChatFormat or InstructionFormat data
    timestamp: datetime = Field(default_factory=datetime.now)

class Dataset(BaseModel):
    entries: List[DataEntry] = []
