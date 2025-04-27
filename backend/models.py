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

class ValidationResult(BaseModel):
    quality_score: int
    issues: List[str] = []
    warnings: List[str] = []
    passes: bool = True

class DataEntry(BaseModel):
    id: str
    type: str  # 'chat' or 'instruction'
    data: Dict[str, Any]  # Will contain either ChatFormat or InstructionFormat data
    timestamp: datetime = Field(default_factory=datetime.now)
    quality_score: int = 100  # Quality score from 0-100

class Dataset(BaseModel):
    entries: List[DataEntry] = []
