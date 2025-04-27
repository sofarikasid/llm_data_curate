from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
import json
import os
import uuid
import sys
from datetime import datetime
from typing import List, Dict, Any

# Add the current directory to sys.path to fix imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
parent_dir = os.path.dirname(current_dir)

# Now import models
from models import DataEntry, Dataset

app = FastAPI(title="LLM Data Curation API")

# Configure CORS to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data storage (in memory for simplicity, would use a database in production)
dataset = Dataset()

# File path for persistent storage - using absolute path
DATA_FILE = os.path.join(parent_dir, "data", "dataset.json")

# Create data directory if it doesn't exist
os.makedirs(os.path.join(parent_dir, "data"), exist_ok=True)

# Load existing data from file if it exists
def load_data():
    global dataset
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                data = json.load(f)
                # Convert the loaded data to our Dataset model
                entries = []
                for entry in data:
                    entries.append(
                        DataEntry(
                            id=entry.get("id", str(uuid.uuid4())),
                            type=entry["type"],
                            data=entry["data"],
                            timestamp=entry.get("timestamp", datetime.now().isoformat())
                        )
                    )
                dataset.entries = entries
        except Exception as e:
            print(f"Error loading data: {e}")

# Save data to file
def save_data():
    with open(DATA_FILE, "w") as f:
        # Convert dataset to JSON-serializable format
        json_data = []
        for entry in dataset.entries:
            json_data.append({
                "id": entry.id,
                "type": entry.type,
                "data": entry.data,
                "timestamp": entry.timestamp.isoformat()
            })
        json.dump(json_data, f, indent=2)

# Load data on startup
@app.on_event("startup")
def startup_event():
    load_data()
    print(f"Server started. Data file: {DATA_FILE}")
    print(f"Serving static files from: {parent_dir}")

# API routes need to be registered before mounting static files
# Define the API prefix
API_PREFIX = "/api"

@app.get(f"{API_PREFIX}")
def read_root():
    return {"message": "Welcome to the LLM Data Curation API"}

@app.get(f"{API_PREFIX}/entries", response_model=List[Dict[str, Any]])
def get_entries():
    # Return all entries in the dataset
    return [entry.dict() for entry in dataset.entries]

@app.post(f"{API_PREFIX}/entries")
def create_entry(entry_data: Dict[str, Any] = Body(...)):
    # Create a new data entry
    try:
        # Generate a unique ID for the entry
        entry_id = str(uuid.uuid4())
        
        # Create a new DataEntry
        new_entry = DataEntry(
            id=entry_id,
            type=entry_data["type"],
            data=entry_data["data"],
            timestamp=datetime.now()
        )
        
        # Add to dataset
        dataset.entries.append(new_entry)
        
        # Save to file
        save_data()
        
        return {"id": entry_id, "message": "Entry added successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get(f"{API_PREFIX}/entries/{{entry_id}}")
def get_entry(entry_id: str):
    # Find and return a specific entry
    for entry in dataset.entries:
        if entry.id == entry_id:
            return entry.dict()
    raise HTTPException(status_code=404, detail="Entry not found")

@app.delete(f"{API_PREFIX}/entries/{{entry_id}}")
def delete_entry(entry_id: str):
    # Delete a specific entry
    global dataset
    for i, entry in enumerate(dataset.entries):
        if entry.id == entry_id:
            dataset.entries.pop(i)
            save_data()
            return {"message": "Entry deleted successfully"}
    raise HTTPException(status_code=404, detail="Entry not found")

@app.delete(f"{API_PREFIX}/entries")
def delete_all_entries():
    # Delete all entries
    global dataset
    dataset.entries = []
    save_data()
    return {"message": "All entries deleted successfully"}

@app.get(f"{API_PREFIX}/download")
def download_dataset():
    # Return the dataset in the format needed for fine-tuning
    formatted_data = []
    for entry in dataset.entries:
        formatted_data.append(entry.data)
    
    # Convert to JSON string
    json_content = json.dumps(formatted_data, indent=2)
    
    # Return as downloadable file
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=llm-dataset.json"}
    )

@app.get(f"{API_PREFIX}/download/jsonl")
def download_dataset_jsonl():
    # Return the dataset in JSONL format
    formatted_data = []
    for entry in dataset.entries:
        formatted_data.append(entry.data)
    
    # Convert to JSONL (one JSON object per line)
    jsonl_content = ""
    for item in formatted_data:
        jsonl_content += json.dumps(item) + "\n"
    
    return Response(
        content=jsonl_content,
        media_type="application/jsonlines",
        headers={"Content-Disposition": "attachment; filename=llm-dataset.jsonl"}
    )

# Mount static files - using absolute path for the directory
app.mount("/", StaticFiles(directory=parent_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
